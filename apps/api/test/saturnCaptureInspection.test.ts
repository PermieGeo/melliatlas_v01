// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import {
  inspectSaturnCaptureFiles,
  parseSaturnCaptureCliArgs,
} from "../src/modules/sources/providers/saturn/saturnCaptureCli.js";
import {
  inspectSaturnCaptureBodies,
  type SaturnCaptureBodies,
} from "../src/modules/sources/providers/saturn/saturnCaptureInspection.js";
import { buildSaturnViewportQuery } from "../src/modules/sources/providers/saturn/saturnViewportQuery.js";

const callback = "capturedCallback";
const queryRequest = buildSaturnViewportQuery({
  districts: [{ id: 1477, name: "Test district", latitude: 55, longitude: 32 }],
  districtId: 1477,
  bbox: { west: 32, south: 54, east: 33, north: 55 },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
  pageNumber: 0,
});
const queryResponse = {
  content: [
    {
      id: 238194,
      planId: 1811436,
      name: "Do not include source name in report",
      centerX: 32.5,
      centerY: 54.5,
    },
    {
      id: 238195,
      planId: 1811436,
      name: "Other private source field",
      centerX: 32.6,
      centerY: 54.6,
    },
  ],
  totalPages: 1,
  totalElements: 2,
  last: true,
  first: true,
  numberOfElements: 2,
  number: 0,
  size: 10,
  empty: false,
  pageable: { pageNumber: 0, pageSize: 10 },
};
const geometry = {
  type: "Polygon",
  coordinates: [
    [
      [32, 54],
      [33, 54],
      [33, 55],
      [32, 54],
    ],
  ],
};
function polygonJsonp(ids: readonly string[] = ["238194", "238196"]): string {
  return `${callback}(${JSON.stringify({
    data: {
      type: "FeatureCollection",
      features: ids.map((id) => ({
        type: "Feature",
        id,
        geometry,
        properties: { privateValue: "never output this property" },
      })),
    },
  })})`;
}

function captures(): SaturnCaptureBodies {
  return {
    queryRequest,
    queryResponse,
    polygonJsonp: polygonJsonp(),
    callback,
    acrCaptures: [
      {
        requestedFeatureId: "238194",
        response: { id: 1586314, secret: "never output this detail" },
      },
    ],
  };
}

describe("offline Saturn capture inspection", () => {
  it("combines one validated page and polygons without upgrading ID matches to facts", () => {
    const report = inspectSaturnCaptureBodies(captures());
    expect(report.status).toBe("ID_ONLY_UNVERIFIED");
    expect(report.selection).toMatchObject({
      districtId: "1477",
      pageNumber: 0,
      totalPages: 1,
      nextPage: null,
      updateMapFrom: "2026-08-01T00:00:00.000Z",
    });
    expect(report.counts).toMatchObject({
      indexEntries: 2,
      polygons: 2,
      acrResponses: 1,
      uniqueExactGeometries: 1,
    });
    expect(report.findings.idMatchCandidates).toEqual([
      expect.objectContaining({
        featureId: "238194",
        relation: "id_match_only",
      }),
    ]);
    expect(report.findings.indexWithoutPolygonIds).toEqual(["238195"]);
    expect(report.findings.polygonWithoutIndexIds).toEqual(["238196"]);
    expect(report.findings.sharedGeometryGroups).toHaveLength(1);
    expect(report.findings.acrObservations).toEqual([
      {
        requestedFeatureId: "238194",
        responseId: "1586314",
        responseIdMatchesRequest: false,
        listedInIndex: true,
        listedInPolygons: true,
      },
    ]);
    expect(JSON.stringify(report)).not.toMatch(
      /Do not include source name|private source field|privateValue|never output|centerX|coordinates/,
    );
    expect(report.limitations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("UpdateMap"),
        expect.stringContaining("district coverage"),
      ]),
    );
  });

  it("rejects malformed pagination, unexpected JSONP callbacks and ACR identities", () => {
    expect(() =>
      inspectSaturnCaptureBodies({
        ...captures(),
        queryResponse: { ...queryResponse, totalElements: 12 },
      }),
    ).toThrow();
    expect(() =>
      inspectSaturnCaptureBodies({ ...captures(), callback: "wrong" }),
    ).toThrow();
    expect(() =>
      inspectSaturnCaptureBodies({
        ...captures(),
        acrCaptures: [{ requestedFeatureId: "238194", response: { id: "1" } }],
      }),
    ).toThrow();
  });

  it("supports absent ACR captures without implying verification", () => {
    const report = inspectSaturnCaptureBodies({
      ...captures(),
      acrCaptures: undefined,
      polygonJsonp: polygonJsonp([]),
    });
    expect(report.findings.idMatchCandidates).toEqual([]);
    expect(report.findings.acrObservations).toEqual([]);
    expect(report.counts.acrResponses).toBe(0);
  });
});

describe("local Saturn capture CLI arguments and bounded files", () => {
  const tempDirectories: string[] = [];
  afterEach(async () => {
    await Promise.all(
      tempDirectories
        .splice(0)
        .map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  it("requires all paths and rejects unrecognized, duplicate and excessive ACR flags", () => {
    const baseArgs = [
      "--query-request",
      "request.json",
      "--query-response",
      "response.json",
      "--polygons",
      "map.jsonp",
      "--callback",
      callback,
    ];
    expect(
      parseSaturnCaptureCliArgs([...baseArgs, "--acr", "238194", "acr.json"]),
    ).toMatchObject({
      callback,
      acrFiles: [{ requestedFeatureId: "238194", path: "acr.json" }],
    });
    expect(() => parseSaturnCaptureCliArgs(baseArgs.slice(0, -2))).toThrow();
    expect(() =>
      parseSaturnCaptureCliArgs([...baseArgs, "--unknown", "x"]),
    ).toThrow();
    expect(() =>
      parseSaturnCaptureCliArgs([...baseArgs, "--callback", "again"]),
    ).toThrow();
    expect(() =>
      parseSaturnCaptureCliArgs([...baseArgs, "--acr", "bad", "acr.json"]),
    ).toThrow();
    expect(() =>
      parseSaturnCaptureCliArgs([
        ...baseArgs,
        ...Array.from({ length: 101 }, () => ["--acr", "123", "a.json"]).flat(),
      ]),
    ).toThrow();
  });

  it("reads local files without returning raw provider attributes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "melliatlas-capture-"));
    tempDirectories.push(dir);
    const requestPath = join(dir, "request.json");
    const responsePath = join(dir, "response.json");
    const polygonPath = join(dir, "response.jsonp");
    const acrPath = join(dir, "acr.json");
    await Promise.all([
      writeFile(requestPath, JSON.stringify(queryRequest)),
      writeFile(responsePath, JSON.stringify(queryResponse)),
      writeFile(polygonPath, polygonJsonp()),
      writeFile(acrPath, JSON.stringify({ id: 1586314, apiKey: "hidden" })),
    ]);
    const options = parseSaturnCaptureCliArgs([
      "--query-request",
      requestPath,
      "--query-response",
      responsePath,
      "--polygons",
      polygonPath,
      "--callback",
      callback,
      "--acr",
      "238194",
      acrPath,
    ]);
    const report = await inspectSaturnCaptureFiles(options);
    expect(report.findings.acrObservations[0].responseId).toBe("1586314");
    expect(JSON.stringify(report)).not.toContain("apiKey");
    const link = join(dir, "symlink.jsonp");
    await symlink(polygonPath, link);
    await expect(
      inspectSaturnCaptureFiles({ ...options, polygonPath: link }),
    ).rejects.toThrow();
    await writeFile(requestPath, " ".repeat(64 * 1024 + 1));
    await expect(inspectSaturnCaptureFiles(options)).rejects.toThrow();
    expect(await readFile(responsePath, "utf8")).toContain(
      "Do not include source name",
    );
  });
});
