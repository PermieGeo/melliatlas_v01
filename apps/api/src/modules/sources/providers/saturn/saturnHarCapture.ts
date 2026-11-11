// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { z } from "zod";
import {
  inspectSaturnCaptureBodies,
  type SaturnCaptureInspection,
} from "./saturnCaptureInspection.js";
import {
  verifySaturnCaptureManifest,
  type SaturnCaptureManifestReport,
} from "./saturnCaptureManifest.js";
import {
  SATURN_CAPTURE_ACR_URL_PREFIX,
  SATURN_CAPTURE_POLYGON_URL,
  SATURN_POLYGON_JSONP_MAX_BYTES,
  SATURN_VIEWPORT_URL,
  SaturnBboxRelation,
} from "./sourceProfile.js";

const MAX_HAR_ENTRIES = 2_000;
const MAX_QUERY_REQUEST_BYTES = 64 * 1024;
const MAX_QUERY_RESPONSE_BYTES = 1024 * 1024;
const MAX_ACR_RESPONSE_BYTES = 256 * 1024;
const featureIdSchema = z.string().regex(/^[1-9][0-9]{0,19}$/);
const harTimestampSchema = z.string().datetime({ offset: true });
const harSchema = z.object({
  log: z.object({ entries: z.array(z.unknown()).max(MAX_HAR_ENTRIES) }),
});

type HarEndpoint = "query" | "polygons" | "acr";
type HarEntry = {
  url: string;
  recordedAt: string;
  requestText?: string;
  responseText: string;
};

export type SaturnHarInspection = SaturnCaptureInspection & {
  provenance: SaturnCaptureManifestReport;
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid HAR entry structure");
  }
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, maxBytes: number): string {
  if (typeof value !== "string") {
    throw new Error("HAR body text is unavailable");
  }
  if (Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new Error("HAR body exceeds the local inspection limit");
  }
  return value;
}

/** Decode only HAR 1.2's text and base64 content forms, never other encodings. */
function responseBody(value: unknown, maxBytes: number): string {
  const content = record(value);
  if (content.encoding === undefined) {
    return boundedText(content.text, maxBytes);
  }
  if (content.encoding !== "base64" || typeof content.text !== "string") {
    throw new Error("Unsupported HAR response content encoding");
  }
  if (
    content.text.length > Math.ceil(maxBytes / 3) * 4 + 4 ||
    content.text.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      content.text,
    )
  ) {
    throw new Error("Invalid bounded HAR base64 response");
  }
  const decoded = Buffer.from(content.text, "base64");
  if (decoded.byteLength > maxBytes) {
    throw new Error("Decoded HAR response exceeds the local limit");
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(decoded);
}

function recordedAt(value: unknown): string {
  return new Date(harTimestampSchema.parse(value)).toISOString();
}

function classify(
  urlText: unknown,
  requestedFeatureId: string,
): HarEndpoint | null {
  if (typeof urlText !== "string") return null;
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    return null;
  }
  if (url.username || url.password || url.hash) return null;
  const endpoint = `${url.origin}${url.pathname}`;
  if (endpoint === SATURN_VIEWPORT_URL) return "query";
  if (endpoint === SATURN_CAPTURE_POLYGON_URL) return "polygons";
  if (endpoint === `${SATURN_CAPTURE_ACR_URL_PREFIX}${requestedFeatureId}`) {
    return "acr";
  }
  return null;
}

function readEntry(value: unknown, endpoint: HarEndpoint): HarEntry {
  const entry = record(value);
  const request = record(entry.request);
  const response = record(entry.response);
  const requiredMethod = endpoint === "query" ? "POST" : "GET";
  const maxResponseBytes =
    endpoint === "query"
      ? MAX_QUERY_RESPONSE_BYTES
      : endpoint === "acr"
        ? MAX_ACR_RESPONSE_BYTES
        : SATURN_POLYGON_JSONP_MAX_BYTES;
  if (
    request.method !== requiredMethod ||
    response.status !== 200 ||
    typeof request.url !== "string"
  ) {
    throw new Error("HAR endpoint method or status is not supported");
  }
  const url = new URL(request.url);
  if (endpoint !== "polygons" && url.search !== "") {
    throw new Error("Unexpected HAR endpoint query parameters");
  }
  const body = responseBody(record(response.content), maxResponseBytes);
  const postData = endpoint === "query" ? record(request.postData) : null;
  return {
    url: request.url,
    recordedAt: recordedAt(entry.startedDateTime),
    ...(postData
      ? { requestText: boundedText(postData.text, MAX_QUERY_REQUEST_BYTES) }
      : {}),
    responseText: body,
  };
}

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Inspect a user-exported HAR entirely offline; no URLs are fetched or echoed.
 * Require one successful capture per endpoint to avoid speculative association
 * when a map session contains multiple unrelated viewports or response versions.
 * HAR metadata is editable and cannot authenticate origin or source reuse rights.
 */
export function inspectSaturnHarCapture(
  input: unknown,
  requestedFeatureId: string,
): SaturnHarInspection {
  featureIdSchema.parse(requestedFeatureId);
  const entries = harSchema.parse(input).log.entries;
  const captured = new Map<HarEndpoint, HarEntry>();
  for (const rawEntry of entries) {
    if (typeof rawEntry !== "object" || rawEntry === null) continue;
    const request = (rawEntry as Record<string, unknown>).request;
    if (typeof request !== "object" || request === null) continue;
    const endpoint = classify(
      (request as Record<string, unknown>).url,
      requestedFeatureId,
    );
    if (!endpoint) continue;
    if (captured.has(endpoint)) {
      throw new Error("Ambiguous HAR: multiple matching endpoint entries");
    }
    captured.set(endpoint, readEntry(rawEntry, endpoint));
  }
  const query = captured.get("query");
  const polygons = captured.get("polygons");
  const acr = captured.get("acr");
  if (!query || !polygons || !acr || !query.requestText) {
    throw new Error(
      "Incomplete HAR: one query, polygon and ACR response required",
    );
  }

  const polygonUrl = new URL(polygons.url);
  const callbacks = polygonUrl.searchParams.getAll("callback");
  if (callbacks.length !== 1 || !callbacks[0]) {
    throw new Error("Missing or repeated HAR polygon callback");
  }
  const queryRequest = JSON.parse(query.requestText) as unknown;
  const queryResponse = JSON.parse(query.responseText) as unknown;
  const acrResponse = JSON.parse(acr.responseText) as unknown;
  const report = inspectSaturnCaptureBodies({
    queryRequest,
    queryResponse,
    polygonJsonp: polygons.responseText,
    callback: callbacks[0],
    acrCaptures: [{ requestedFeatureId, response: acrResponse }],
  });
  const queryRequestSha256 = digest(query.requestText);
  const queryResponseSha256 = digest(query.responseText);
  const polygonResponseSha256 = digest(polygons.responseText);
  const acrResponseSha256 = digest(acr.responseText);
  const provenance = verifySaturnCaptureManifest(
    {
      schemaVersion: 1,
      query: {
        requestSha256: queryRequestSha256,
        responseSha256: queryResponseSha256,
        capturedAt: query.recordedAt,
      },
      polygons: {
        responseSha256: polygonResponseSha256,
        capturedAt: polygons.recordedAt,
        requestUrl: polygons.url,
      },
      acr: [
        {
          requestedFeatureId,
          responseSha256: acrResponseSha256,
          capturedAt: acr.recordedAt,
          requestUrl: acr.url,
        },
      ],
    },
    {
      queryRequestSha256,
      queryResponseSha256,
      polygonResponseSha256,
      acrResponses: [{ requestedFeatureId, sha256: acrResponseSha256 }],
    },
    queryRequest,
    callbacks[0],
  );
  if (provenance.polygonBboxRelation === SaturnBboxRelation.Disjoint) {
    throw new Error("HAR query and polygon request viewports are disjoint");
  }
  return {
    ...report,
    provenance: {
      ...provenance,
      limitations: [
        ...provenance.limitations,
        "HAR request-start timestamps and decoded response texts are self-reported export contents, not authenticated server receipts.",
        "One matching HAR entry per endpoint does not prove a field-to-polygon join or source-use permission.",
      ],
    },
  };
}
