// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it } from "vitest";
import {
  verifySaturnCaptureManifest,
  type SaturnCaptureFileHashes,
} from "../src/modules/sources/providers/saturn/saturnCaptureManifest.js";

const hash = (value: string): string => value.repeat(64);
const queryCapturedAt = "2026-11-07T08:00:00.000Z";
const polygonCapturedAt = "2026-11-07T08:00:01.250Z";
const acrCapturedAt = "2026-11-07T08:00:02.000Z";
const polygonUrl =
  "https://bee-saturn.ru/backend/beemaster/geojson-polygons?bbox=opaque-value&zoom=13&subject=55&callback=capturedCallback";
const acrUrl = "https://bee-saturn.ru/backend/beemaster/acr/238194";

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
    "55",
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
    });
    expect(report.limitations.join(" ")).toMatch(/not authenticated/);
    expect(report.limitations.join(" ")).toMatch(/bbox contents/);
    expect(JSON.stringify(report)).not.toContain("opaque-value");
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
      polygonUrl.replace("bbox=opaque-value&", ""),
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
