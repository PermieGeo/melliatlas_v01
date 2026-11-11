// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it } from "vitest";
import {
  verifySaturnCaptureManifest,
  type SaturnCaptureFileHashes,
} from "../src/modules/sources/providers/saturn/saturnCaptureManifest.js";
import { buildSaturnViewportQuery } from "../src/modules/sources/providers/saturn/saturnViewportQuery.js";

const hash = (value: string): string => value.repeat(64);
const queryCapturedAt = "2026-11-07T08:00:00.000Z";
const polygonCapturedAt = "2026-11-07T08:00:01.250Z";
const acrCapturedAt = "2026-11-07T08:00:02.000Z";
const polygonUrl =
  "https://bee-saturn.ru/backend/beemaster/geojson-polygons?bbox=32,54,33,55&zoom=13&subject=55&callback=capturedCallback";
const acrUrl = "https://bee-saturn.ru/backend/beemaster/acr/238194";
const queryRequest = buildSaturnViewportQuery({
  regionCode: "55",
  districts: [{ id: 1477, name: "Test district", latitude: 55, longitude: 32 }],
  districtId: 1477,
  bbox: { west: 32, south: 54, east: 33, north: 55 },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
  pageNumber: 0,
});

function sampleManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    query: {
      requestSha256: hash("a"),
      responseSha256: hash("b"),
      capturedAt: queryCapturedAt,
    },
    polygons: {
      responseSha256: hash("c"),
      capturedAt: polygonCapturedAt,
      requestUrl: polygonUrl,
    },
    acr: [
      {
        requestedFeatureId: "238194",
        responseSha256: hash("d"),
        capturedAt: acrCapturedAt,
        requestUrl: acrUrl,
      },
    ],
  };
}

const matchingHashes: SaturnCaptureFileHashes = {
  queryRequestSha256: hash("a"),
  queryResponseSha256: hash("b"),
  polygonResponseSha256: hash("c"),
  acrResponses: [{ requestedFeatureId: "238194", sha256: hash("d") }],
};

function verify(
  manifest: unknown,
  hashes: SaturnCaptureFileHashes = matchingHashes,
): ReturnType<typeof verifySaturnCaptureManifest> {
  return verifySaturnCaptureManifest(
    manifest,
    hashes,
    queryRequest,
    "capturedCallback",
  );
}

describe("offline Saturn capture manifest integrity", () => {
  it("binds local file digests without authenticating timestamps or joining records", () => {
    const report = verify(sampleManifest());
    expect(report).toMatchObject({
      status: "SELF_REPORTED_METADATA_HASH_BOUND",
      reportedCaptureSpanMs: 2000,
      polygonZoom: 13,
      polygonBboxParameterPresent: true,
      polygonBboxRelation: "identical",
    });
    expect(report.limitations.join(" ")).toMatch(/not authenticated/);
    expect(report.limitations.join(" ")).toMatch(
      /does not prove polygon coverage/,
    );
    expect(JSON.stringify(report)).not.toContain("32,54,33,55");
  });

  it("checks bbox and identities for undated browser captures without enabling undated collection", () => {
    const filter = { ...queryRequest.filter };
    delete (filter as Partial<typeof filter>).startDateUpdateMap;
    delete (filter as Partial<typeof filter>).endDateUpdateMap;
    expect(
      verifySaturnCaptureManifest(
        sampleManifest(),
        matchingHashes,
        { ...queryRequest, filter },
        "capturedCallback",
      ),
    ).toMatchObject({
      status: "SELF_REPORTED_METADATA_HASH_BOUND",
      polygonBboxRelation: "identical",
    });
  });

  it("reports overlap and disjoint rectangles without claiming matching features", () => {
    for (const [bbox, expected] of [
      ["32.5,54.5,33.5,55.5", "overlapping"],
      ["34,56,35,57", "disjoint"],
    ] as const) {
      const manifest = sampleManifest();
      const polygons = manifest.polygons as Record<string, unknown>;
      polygons.requestUrl = polygonUrl.replace("32,54,33,55", bbox);
      expect(verify(manifest).polygonBboxRelation).toBe(expected);
    }
  });

  it("accepts the geographic bbox endpoints without inferring source coverage", () => {
    const manifest = sampleManifest();
    const polygons = manifest.polygons as Record<string, unknown>;
    polygons.requestUrl = polygonUrl.replace("32,54,33,55", "-180,-90,180,90");
    expect(verify(manifest).polygonBboxRelation).toBe("overlapping");
  });

  it("rejects malformed, degenerate and out-of-range polygon request rectangles", () => {
    for (const bbox of [
      "opaque-value",
      "32,54,32,55",
      "33,54,32,55",
      "32,55,33,54",
      "32,54,200,55",
      "32,54,33,95",
      "-180.01,54,33,55",
      "32,-90.01,33,55",
      "32,54,33",
      "32,54,33,55,56",
      "32,54,Infinity,55",
      "32,54,33,%2055",
    ]) {
      const manifest = sampleManifest();
      const polygons = manifest.polygons as Record<string, unknown>;
      polygons.requestUrl = polygonUrl.replace("32,54,33,55", bbox);
      expect(() => verify(manifest)).toThrow();
    }
  });

  it("refuses altered request, polygon and ACR bytes", () => {
    expect(() =>
      verify(sampleManifest(), {
        ...matchingHashes,
        queryRequestSha256: hash("0"),
      }),
    ).toThrow();
    expect(() =>
      verify(sampleManifest(), {
        ...matchingHashes,
        polygonResponseSha256: hash("0"),
      }),
    ).toThrow();
    expect(() =>
      verify(sampleManifest(), {
        ...matchingHashes,
        acrResponses: [{ requestedFeatureId: "238194", sha256: hash("0") }],
      }),
    ).toThrow();
  });

  it("requires an exact ACR response identity and a bounded capture list", () => {
    expect(() =>
      verify(sampleManifest(), {
        ...matchingHashes,
        acrResponses: [{ requestedFeatureId: "238195", sha256: hash("d") }],
      }),
    ).toThrow();
    expect(() =>
      verify(sampleManifest(), { ...matchingHashes, acrResponses: [] }),
    ).toThrow();
    expect(() =>
      verify({
        ...sampleManifest(),
        acr: Array.from({ length: 101 }, () => ({
          requestedFeatureId: "1",
          responseSha256: hash("d"),
          capturedAt: acrCapturedAt,
          requestUrl: acrUrl,
        })),
      }),
    ).toThrow();
  });

  it("rejects wrong provider, callback, subject and absent bbox evidence", () => {
    for (const requestUrl of [
      polygonUrl.replace("bee-saturn.ru", "example.org"),
      polygonUrl.replace("subject=55", "subject=77"),
      polygonUrl.replace("capturedCallback", "anotherCallback"),
      polygonUrl.replace("bbox=32,54,33,55&", ""),
      polygonUrl.replace("zoom=13", "zoom=wrong"),
    ]) {
      expect(() =>
        verify({
          ...sampleManifest(),
          polygons: {
            responseSha256: hash("c"),
            capturedAt: polygonCapturedAt,
            requestUrl,
          },
        }),
      ).toThrow();
    }
  });

  it("rejects wrong ACR URL, extraneous fields and invalid UTC times", () => {
    const original = sampleManifest();
    const originalAcr = (original.acr as Record<string, unknown>[])[0];
    expect(() =>
      verify({
        ...original,
        acr: [
          { ...originalAcr, requestUrl: acrUrl.replace("238194", "238195") },
        ],
      }),
    ).toThrow();
    expect(() => verify({ ...original, unexpected: "ignore me" })).toThrow();
    expect(() =>
      verify({
        ...original,
        query: {
          requestSha256: hash("a"),
          responseSha256: hash("b"),
          capturedAt: "2026-02-30T08:00:00.000Z",
        },
      }),
    ).toThrow();
  });
});
