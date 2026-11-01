#!/usr/bin/env node
/** Probe one bounded page from the configured reference provider without storing personal records. */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const presetPath = new URL(
  "../apps/api/config/providers/fgis-saturn.json",
  import.meta.url,
);

export function summarizePage(data) {
  if (!data || !Array.isArray(data.content)) {
    throw new Error("Unexpected JSON response: content must be an array");
  }
  const polygons = data.content.filter((item) => {
    const geo = item?.beeAcreage?.geo;
    return (
      geo &&
      ["Polygon", "MultiPolygon"].includes(geo.type) &&
      Array.isArray(geo.coordinates)
    );
  });
  return {
    responseRecords: data.content.length,
    totalElements: Number.isInteger(data.totalElements)
      ? data.totalElements
      : null,
    polygonCandidates: polygons.length,
    missingOrUnsupportedGeometry: data.content.length - polygons.length,
    firstGeometryType: polygons[0]?.beeAcreage?.geo?.type ?? null,
  };
}

export async function checkSaturn({ fetcher = fetch, timeoutMs = 12000 } = {}) {
  const preset = JSON.parse(await readFile(presetPath, "utf8"));
  const url = new URL(preset.url);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "bee-saturn.ru" ||
    url.pathname !== "/backend/beemaster/planapplybees"
  ) {
    throw new Error("The probe only accepts the known reference endpoint");
  }
  const request = preset.request;
  if (request.method !== "POST") throw new Error("Expected a POST preset");
  const payload = {
    ...request.parameters,
    [request.regionContainer]: {
      [request.regionParameter]: request.regionCode,
    },
  };
  payload.pageNumber = 0;
  payload.pageSize = 1;
  console.info(
    `POST ${url.toString()} (pageNumber=0, pageSize=1, regionCode=${request.regionCode})`,
  );
  const response = await fetcher(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "identity",
      "User-Agent": "MelliAtlas-SourceFetcher/1.0",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(payload),
  });
  console.info(
    `HTTP ${response.status}; content-type=${response.headers.get("content-type") ?? "unknown"}`,
  );
  if (!response.ok)
    throw new Error(`Provider returned HTTP ${response.status}`);
  const encoding = response.headers.get("content-encoding");
  if (encoding && encoding !== "identity")
    throw new Error(`Provider uses unsupported response encoding: ${encoding}`);
  if (
    !(response.headers.get("content-type") ?? "").includes("application/json")
  ) {
    throw new Error("Provider did not return application/json");
  }
  const size = Number(response.headers.get("content-length") ?? 0);
  if (size > 2000000) throw new Error("Response exceeds 2 MB limit");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response body");
  let total = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 2000000) throw new Error("Response exceeds 2 MB limit");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const summary = summarizePage(JSON.parse(bytes.toString("utf8")));
  console.info(JSON.stringify(summary, null, 2));
  return summary;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  checkSaturn().catch((error) => {
    console.error(
      `API check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
