// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectSaturnCaptureBodies,
  type SaturnCaptureBodies,
  type SaturnCaptureInspection,
} from "./saturnCaptureInspection.js";
import {
  verifySaturnCaptureManifest,
  type SaturnCaptureManifestReport,
} from "./saturnCaptureManifest.js";

const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_POLYGON_BYTES = 8 * 1024 * 1024;
const MAX_ACR_BYTES = 256 * 1024;
const MAX_ACR_FILES = 100;
const MAX_MANIFEST_BYTES = 64 * 1024;

export type SaturnCaptureCliOptions = {
  queryRequestPath: string;
  queryResponsePath: string;
  polygonPath: string;
  callback: string;
  acrFiles: Array<{ requestedFeatureId: string; path: string }>;
  manifestPath?: string;
};

export type SaturnCaptureFileReport = SaturnCaptureInspection & {
  provenance: SaturnCaptureManifestReport | { status: "NOT_PROVIDED" };
};

type BoundedFile = { text: string; sha256: string };
type JsonCapture = { value: unknown; sha256: string };

const usage = [
  "Offline Saturn capture inspection (no HTTP requests or database writes)",
  "Usage: pnpm --dir apps/api evidence:saturn -- --query-request <request.json> --query-response <response.json> --polygons <response.jsonp> --callback <name> [--acr <requestedFeatureId> <response.json>]... [--manifest <manifest.json>]",
  "Input files must contain direct provider bodies, not HAR wrappers.",
  "Output includes source IDs and hashes only; it does not verify cross-endpoint joins.",
].join("\n");

/** Parse local CLI arguments without accepting arbitrary provider destinations. */
export function parseSaturnCaptureCliArgs(
  args: readonly string[],
): SaturnCaptureCliOptions {
  const values = new Map<string, string>();
  const acrFiles: SaturnCaptureCliOptions["acrFiles"] = [];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--") continue;
    if (flag === "--acr") {
      const requestedFeatureId = args[++i];
      const path = args[++i];
      if (
        !requestedFeatureId ||
        !/^[1-9][0-9]{0,19}$/.test(requestedFeatureId) ||
        !path ||
        acrFiles.length >= MAX_ACR_FILES
      ) {
        throw new Error("Invalid --acr argument");
      }
      acrFiles.push({ requestedFeatureId, path });
      continue;
    }
    if (
      ![
        "--query-request",
        "--query-response",
        "--polygons",
        "--callback",
        "--manifest",
      ].includes(flag) ||
      values.has(flag)
    ) {
      throw new Error("Unknown or duplicate capture argument");
    }
    const value = args[++i];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing capture argument value");
    }
    values.set(flag, value);
  }

  const queryRequestPath = values.get("--query-request");
  const queryResponsePath = values.get("--query-response");
  const polygonPath = values.get("--polygons");
  const callback = values.get("--callback");
  if (!queryRequestPath || !queryResponsePath || !polygonPath || !callback) {
    throw new Error("Missing required capture arguments");
  }
  return {
    queryRequestPath,
    queryResponsePath,
    polygonPath,
    callback,
    acrFiles,
    ...(values.has("--manifest")
      ? { manifestPath: values.get("--manifest") }
      : {}),
  };
}

/** Reject symlinks and oversized files before loading a local capture. */
async function readBoundedCapture(
  path: string,
  maxBytes: number,
): Promise<BoundedFile> {
  const info = await lstat(path);
  if (!info.isFile() || info.size > maxBytes) {
    throw new Error("Invalid capture file size or type");
  }
  const data = await readFile(path);
  if (data.byteLength > maxBytes) {
    throw new Error("Capture grew beyond the permitted limit");
  }
  return {
    text: new TextDecoder("utf-8", { fatal: true }).decode(data),
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

async function readJsonCapture(
  path: string,
  maxBytes: number,
): Promise<JsonCapture> {
  const capture = await readBoundedCapture(path, maxBytes);
  return { value: JSON.parse(capture.text) as unknown, sha256: capture.sha256 };
}

/** Load independently captured local bodies; never retrieve remote URLs. */
export async function inspectSaturnCaptureFiles(
  options: SaturnCaptureCliOptions,
): Promise<SaturnCaptureFileReport> {
  const [[queryRequest, queryResponse, polygons], acrResponses, manifest] =
    await Promise.all([
      Promise.all([
        readJsonCapture(options.queryRequestPath, MAX_REQUEST_BYTES),
        readJsonCapture(options.queryResponsePath, MAX_RESPONSE_BYTES),
        readBoundedCapture(options.polygonPath, MAX_POLYGON_BYTES),
      ]),
      Promise.all(
        options.acrFiles.map(({ path }) =>
          readJsonCapture(path, MAX_ACR_BYTES),
        ),
      ),
      options.manifestPath
        ? readJsonCapture(options.manifestPath, MAX_MANIFEST_BYTES)
        : Promise.resolve(undefined),
    ]);
  const captures: SaturnCaptureBodies = {
    queryRequest: queryRequest.value,
    queryResponse: queryResponse.value,
    polygonJsonp: polygons.text,
    callback: options.callback,
    acrCaptures: options.acrFiles.map((capture, index) => ({
      requestedFeatureId: capture.requestedFeatureId,
      response: acrResponses[index].value,
    })),
  };
  const report = inspectSaturnCaptureBodies(captures);
  const provenance = manifest
    ? verifySaturnCaptureManifest(
        manifest.value,
        {
          queryRequestSha256: queryRequest.sha256,
          queryResponseSha256: queryResponse.sha256,
          polygonResponseSha256: polygons.sha256,
          acrResponses: options.acrFiles.map((item, index) => ({
            requestedFeatureId: item.requestedFeatureId,
            sha256: acrResponses[index].sha256,
          })),
        },
        queryRequest.value,
        options.callback,
      )
    : { status: "NOT_PROVIDED" as const };
  return { ...report, provenance };
}

async function main(args: readonly string[]): Promise<void> {
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(`${usage}\n`);
    return;
  }
  try {
    const report = await inspectSaturnCaptureFiles(
      parseSaturnCaptureCliArgs(args),
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch {
    // Keep raw provider records and local file paths out of diagnostics.
    process.stderr.write(`Capture inspection failed.\n${usage}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main(process.argv.slice(2));
}
