// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";
import {
  SATURN_CAPTURE_ACR_URL_PREFIX,
  SATURN_CAPTURE_POLYGON_URL,
  SATURN_MAX_ACR_CAPTURE_FILES,
  SaturnBboxRelation,
  SaturnCaptureStatus,
} from "./sourceProfile.js";
import { validateSaturnCapturedViewportQuery } from "./saturnViewportQuery.js";

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const featureIdSchema = z.string().regex(/^[1-9][0-9]{0,19}$/);
const timestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
  });
const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    query: z
      .object({
        requestSha256: digestSchema,
        responseSha256: digestSchema,
        capturedAt: timestampSchema,
      })
      .strict(),
    polygons: z
      .object({
        responseSha256: digestSchema,
        capturedAt: timestampSchema,
        requestUrl: z.string().min(1).max(5000),
      })
      .strict(),
    acr: z
      .array(
        z
          .object({
            requestedFeatureId: featureIdSchema,
            responseSha256: digestSchema,
            capturedAt: timestampSchema,
            requestUrl: z.string().min(1).max(5000),
          })
          .strict(),
      )
      .max(SATURN_MAX_ACR_CAPTURE_FILES),
  })
  .strict();

export type SaturnCaptureFileHashes = {
  queryRequestSha256: string;
  queryResponseSha256: string;
  polygonResponseSha256: string;
  acrResponses: readonly { requestedFeatureId: string; sha256: string }[];
};

export type SaturnCaptureManifestReport = {
  status: `${SaturnCaptureStatus.MetadataHashBound}`;
  reportedCaptureSpanMs: number;
  polygonZoom: number;
  polygonBboxParameterPresent: true;
  polygonBboxRelation: `${SaturnBboxRelation}`;
  limitations: readonly string[];
};

type Bbox = { west: number; south: number; east: number; north: number };
const BBOX_COMPONENT_COUNT = 4;

/** Parse the observed west,south,east,north request bounds, not polygon geometry. */
function parsePolygonRequestBbox(value: string): Bbox {
  const values = value.split(",");
  if (
    values.length !== BBOX_COMPONENT_COUNT ||
    values.some((item) => !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(item))
  ) {
    throw new Error("Invalid Saturn polygon bbox parameter");
  }
  const [west, south, east, north] = values.map(Number);
  if (
    ![west, south, east, north].every(Number.isFinite) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    throw new Error("Invalid Saturn polygon bbox coordinates");
  }
  return { west, south, east, north };
}

function bboxRelation(
  a: Bbox,
  b: Bbox,
): SaturnCaptureManifestReport["polygonBboxRelation"] {
  if (
    a.west === b.west &&
    a.south === b.south &&
    a.east === b.east &&
    a.north === b.north
  ) {
    return SaturnBboxRelation.Identical;
  }
  return a.west < b.east &&
    b.west < a.east &&
    a.south < b.north &&
    b.south < a.north
    ? SaturnBboxRelation.Overlapping
    : SaturnBboxRelation.Disjoint;
}

function expectedSourceUrl(value: string, expectedUrl: string): URL {
  const url = new URL(value);
  if (
    `${url.origin}${url.pathname}` !== expectedUrl ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    throw new Error("Unexpected Saturn capture request URL");
  }
  return url;
}

function oneParameter(url: URL, key: string): string {
  const values = url.searchParams.getAll(key);
  if (values.length !== 1 || !values[0]) {
    throw new Error("Missing or repeated Saturn request parameter");
  }
  return values[0];
}

/**
 * Bind manually recorded capture metadata to exact local body bytes.
 * Source host, endpoint, callback and subject must match the observed profile.
 * Compare numeric requested viewports without asserting feature correspondence.
 * Matching hashes do not authenticate the browser, server, time or legal rights.
 * This is an offline evidence check, not the live indexed-page ingestion path.
 *
 * @throws Error for malformed, inconsistent or incorrectly bound metadata.
 */
export function verifySaturnCaptureManifest(
  input: unknown,
  hashes: SaturnCaptureFileHashes,
  queryRequest: unknown,
  callback: string,
): SaturnCaptureManifestReport {
  const manifest = manifestSchema.parse(input);
  const query = validateSaturnCapturedViewportQuery(queryRequest);
  if (
    hashes.queryRequestSha256 !== manifest.query.requestSha256 ||
    hashes.queryResponseSha256 !== manifest.query.responseSha256 ||
    hashes.polygonResponseSha256 !== manifest.polygons.responseSha256 ||
    hashes.acrResponses.length !== manifest.acr.length
  ) {
    throw new Error("Manifest does not match supplied capture bodies");
  }

  const actualAcr = new Map<string, string>();
  for (const capture of hashes.acrResponses) {
    if (actualAcr.has(capture.requestedFeatureId)) {
      throw new Error("Duplicate ACR capture ID");
    }
    actualAcr.set(capture.requestedFeatureId, capture.sha256);
  }
  for (const entry of manifest.acr) {
    if (actualAcr.get(entry.requestedFeatureId) !== entry.responseSha256) {
      throw new Error("Manifest ACR digest or requested ID mismatch");
    }
    actualAcr.delete(entry.requestedFeatureId);
    const url = expectedSourceUrl(
      entry.requestUrl,
      `${SATURN_CAPTURE_ACR_URL_PREFIX}${entry.requestedFeatureId}`,
    );
    if (url.search !== "") {
      throw new Error("Unexpected ACR request parameters");
    }
  }

  const url = expectedSourceUrl(
    manifest.polygons.requestUrl,
    SATURN_CAPTURE_POLYGON_URL,
  );
  if (
    oneParameter(url, "subject") !== query.filter.subject ||
    oneParameter(url, "callback") !== callback
  ) {
    throw new Error("Polygon request identity does not match query context");
  }
  const polygonBbox = parsePolygonRequestBbox(oneParameter(url, "bbox"));
  const queryBbox = {
    west: query.filter.leftTop.longitude,
    south: query.filter.rightDown.latitude,
    east: query.filter.rightDown.longitude,
    north: query.filter.leftTop.latitude,
  };
  const zoomText = oneParameter(url, "zoom");
  const polygonZoom = Number(zoomText);
  if (!/^\d+$/.test(zoomText) || !Number.isSafeInteger(polygonZoom)) {
    throw new Error("Invalid polygon request zoom");
  }

  const times = [
    manifest.query.capturedAt,
    manifest.polygons.capturedAt,
    ...manifest.acr.map((item) => item.capturedAt),
  ].map((value) => Date.parse(value));
  return {
    status: SaturnCaptureStatus.MetadataHashBound,
    reportedCaptureSpanMs: Math.max(...times) - Math.min(...times),
    polygonZoom,
    polygonBboxParameterPresent: true,
    polygonBboxRelation: bboxRelation(queryBbox, polygonBbox),
    limitations: [
      "Manifest timestamps and request URLs are operator-supplied, not authenticated.",
      "Requested viewport overlap does not prove polygon coverage or feature identity.",
      "Body digests prove local file binding only, not a cross-endpoint join.",
    ],
  };
}
