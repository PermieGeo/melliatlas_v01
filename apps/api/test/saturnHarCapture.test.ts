// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectSaturnHarFile,
  parseSaturnHarCliArgs,
} from "../src/modules/sources/providers/saturn/saturnCaptureCli.js";
import { inspectSaturnHarCapture } from "../src/modules/sources/providers/saturn/saturnHarCapture.js";
import { buildSaturnViewportQuery } from "../src/modules/sources/providers/saturn/saturnViewportQuery.js";

const fieldId = "2038836";
const queryRequest = buildSaturnViewportQuery({
  regionCode: "55",
  districts: [
    { id: 1477, name: "Sample district", latitude: 55, longitude: 32 },
  ],
  districtId: 1477,
  bbox: { west: 32, south: 54, east: 33, north: 55 },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
  pageNumber: 0,
});
const queryResponse = {
  content: [
    {
      id: 2038836,
      planId: 1811436,
      name: "Do not reveal provider farm name",
      centerX: 32.5,
      centerY: 54.5,
    },
  ],
  totalPages: 1,
  totalElements: 1,
  last: true,
  first: true,
  numberOfElements: 1,
  number: 0,
  size: 10,
  empty: false,
  pageable: { pageNumber: 0, pageSize: 10 },
};
const polygonUrl =
  "https://bee-saturn.ru/backend/beemaster/geojson-polygons?bbox=32,54,33,55&zoom=16&subject=55&callback=cb";
const polygonResponse = `cb(${JSON.stringify({
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: fieldId,
        properties: { privateNote: "Never expose polygon properties" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [32, 54],
              [33, 54],
              [33, 55],
              [32, 55],
              [32, 54],
            ],
          ],
        },
      },
    ],
  },
})})`;

type HarEntry = {
  startedDateTime: string;
  request: {
    method: string;
    url: string;
    postData?: { mimeType: string; text?: string };
    headers?: Array<{ name: string; value: string }>;
  };
  response: {
    status: number;
    content: { text?: string; encoding?: string; mimeType: string };
  };
};

function harEntry(
  startedDateTime: string,
  method: string,
  url: string,
  body: string,
): HarEntry {
  return {
    startedDateTime,
    request: {
      method,
      url,
      headers: [{ name: "Authorization", value: "Do not expose secret" }],
    },
    response: {
      status: 200,
      content: { text: body, mimeType: "application/json" },
    },
  };
}

function validHar(): { log: { version: string; entries: HarEntry[] } } {
  const query = harEntry(
    "2026-11-11T12:00:00.000+00:00",
    "POST",
    "https://bee-saturn.ru/backend/beemaster/query",
    JSON.stringify(queryResponse),
  );
  query.request.postData = {
    mimeType: "application/json",
    text: JSON.stringify(queryRequest),
  };
  const polygons = harEntry(
    "2026-11-11T12:00:01.000Z",
    "GET",
    polygonUrl,
    Buffer.from(polygonResponse, "utf8").toString("base64"),
  );
  polygons.response.content.encoding = "base64";
  const acr = harEntry(
    "2026-11-11T12:00:02.000Z",
    "GET",
    `https://bee-saturn.ru/backend/beemaster/acr/${fieldId}`,
    JSON.stringify({
      id: 1811436,
      centerX: 32.5,
      centerY: 54.5,
      startPlanDate: "2026-08-09T00:00:00Z",
      name: "Do not reveal ACR company name",
    }),
  );
  return {
    log: {
      version: "1.2",
      entries: [
        harEntry(
          "2026-11-11T11:59:59.000Z",
          "GET",
          "https://example.org/unrelated",
          "PRIVATE",
        ),
        query,
        polygons,
        acr,
      ],
    },
  };
}

describe("offline Saturn HAR capture inspection", () => {
  it("binds a single three-endpoint HAR trace without authenticating geometry", () => {
    const report = inspectSaturnHarCapture(validHar(), fieldId);
    expect(report).toMatchObject({
      status: "ID_ONLY_UNVERIFIED",
      selection: { subject: "55", districtId: "1477" },
      counts: { indexEntries: 1, polygons: 1, acrResponses: 1 },
      provenance: {
        status: "SELF_REPORTED_METADATA_HASH_BOUND",
        reportedCaptureSpanMs: 2000,
        polygonZoom: 16,
        polygonBboxRelation: "identical",
      },
    });
    expect(report.findings.threeEndpointCandidates).toEqual([
      expect.objectContaining({ featureId: fieldId }),
    ]);
    expect(report.findings.acrObservations[0]).toMatchObject({
      requestedFeatureId: fieldId,
      responseId: "1811436",
      planRelation: "matches_index_plan",
      centerRelation: "matches_index_center_within_tolerance",
    });
    expect(report.provenance.limitations.join(" ")).toContain(
      "HAR request-start",
    );
    expect(JSON.stringify(report)).not.toMatch(
      /Do not reveal|Never expose|PRIVATE|Authorization|example.org|coordinates|32\.5/,
    );
  });

  it("rejects ambiguous map pages, polygon responses and duplicate ACR requests", () => {
    for (const index of [1, 2, 3]) {
      const har = validHar();
      har.log.entries.push(structuredClone(har.log.entries[index]));
      expect(() => inspectSaturnHarCapture(har, fieldId)).toThrow(
        /Ambiguous HAR/,
      );
    }
  });

  it("rejects missing endpoint bodies, failed responses and modified methods", () => {
    for (const index of [1, 2, 3]) {
      const missing = validHar();
      missing.log.entries.splice(index, 1);
      expect(() => inspectSaturnHarCapture(missing, fieldId)).toThrow();
      const noBody = validHar();
      delete noBody.log.entries[index].response.content.text;
      expect(() => inspectSaturnHarCapture(noBody, fieldId)).toThrow();
      const failed = validHar();
      failed.log.entries[index].response.status = 503;
      expect(() => inspectSaturnHarCapture(failed, fieldId)).toThrow();
    }
    const wrongMethod = validHar();
    wrongMethod.log.entries[1].request.method = "GET";
    expect(() => inspectSaturnHarCapture(wrongMethod, fieldId)).toThrow();
    const noPostData = validHar();
    delete noPostData.log.entries[1].request.postData;
    expect(() => inspectSaturnHarCapture(noPostData, fieldId)).toThrow();
  });

  it("rejects altered origin, callback, bbox, timestamps and unsupported encodings", () => {
    const wrongOrigin = validHar();
    wrongOrigin.log.entries[2].request.url = polygonUrl.replace(
      "bee-saturn.ru",
      "other.example",
    );
    expect(() => inspectSaturnHarCapture(wrongOrigin, fieldId)).toThrow();
    const wrongCallback = validHar();
    wrongCallback.log.entries[2].request.url = polygonUrl.replace(
      "callback=cb",
      "callback=other",
    );
    expect(() => inspectSaturnHarCapture(wrongCallback, fieldId)).toThrow();
    const badBbox = validHar();
    badBbox.log.entries[2].request.url = polygonUrl.replace(
      "32,54,33,55",
      "32,54,32,55",
    );
    expect(() => inspectSaturnHarCapture(badBbox, fieldId)).toThrow();
    const badTime = validHar();
    badTime.log.entries[3].startedDateTime = "never";
    expect(() => inspectSaturnHarCapture(badTime, fieldId)).toThrow();
    const normalizedInvalidDate = validHar();
    normalizedInvalidDate.log.entries[3].startedDateTime =
      "2026-02-30T12:00:00.000Z";
    expect(() =>
      inspectSaturnHarCapture(normalizedInvalidDate, fieldId),
    ).toThrow();
    const disjoint = validHar();
    disjoint.log.entries[2].request.url = polygonUrl.replace(
      "32,54,33,55",
      "34,56,35,57",
    );
    expect(() => inspectSaturnHarCapture(disjoint, fieldId)).toThrow();
    const badEncoding = validHar();
    badEncoding.log.entries[2].response.content.encoding = "gzip";
    expect(() => inspectSaturnHarCapture(badEncoding, fieldId)).toThrow();
    const badBase64 = validHar();
    badBase64.log.entries[2].response.content.text = "%%%=";
    expect(() => inspectSaturnHarCapture(badBase64, fieldId)).toThrow();
  });

  it("rejects oversized, invalid and untrusted HAR content without interpreting it", () => {
    const tooMany = validHar();
    tooMany.log.entries = Array.from(
      { length: 2001 },
      () => tooMany.log.entries[0],
    );
    expect(() => inspectSaturnHarCapture(tooMany, fieldId)).toThrow();
    const oversized = validHar();
    oversized.log.entries[1].response.content.text = "x".repeat(
      1024 * 1024 + 1,
    );
    expect(() => inspectSaturnHarCapture(oversized, fieldId)).toThrow();
    const wrongFieldId = validHar();
    expect(() => inspectSaturnHarCapture(wrongFieldId, "2038837")).toThrow();
    expect(() => inspectSaturnHarCapture({}, fieldId)).toThrow();
    expect(() => inspectSaturnHarCapture(validHar(), "invalid-id")).toThrow();
  });
});

describe("Saturn HAR CLI", () => {
  const temporaryDirectories: string[] = [];
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  it("requires one HAR path and a valid requested field ID", () => {
    expect(
      parseSaturnHarCliArgs(["--har", "short.har", "--acr-id", fieldId]),
    ).toEqual({
      harPath: "short.har",
      requestedFeatureId: fieldId,
    });
    for (const invalid of [
      ["--har", "short.har"],
      ["--acr-id", fieldId],
      ["--har", "short.har", "--acr-id", "bad"],
      ["--har", "short.har", "--acr-id", fieldId, "--acr-id", fieldId],
      ["--har", "short.har", "--acr-id", fieldId, "--manifest", "x"],
    ]) {
      expect(() => parseSaturnHarCliArgs(invalid)).toThrow();
    }
  });

  it("reads an offline HAR file, reports its digest and rejects symlinks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "melliatlas-har-"));
    temporaryDirectories.push(dir);
    const harPath = join(dir, "capture.har");
    await writeFile(harPath, JSON.stringify(validHar()));
    const report = await inspectSaturnHarFile({
      harPath,
      requestedFeatureId: fieldId,
    });
    expect(report.harFileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.findings.threeEndpointCandidates).toHaveLength(1);
    const symlinkPath = join(dir, "link.har");
    await symlink(harPath, symlinkPath);
    await expect(
      inspectSaturnHarFile({
        harPath: symlinkPath,
        requestedFeatureId: fieldId,
      }),
    ).rejects.toThrow();
  });
});
