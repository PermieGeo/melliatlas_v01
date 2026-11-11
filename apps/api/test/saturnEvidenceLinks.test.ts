// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it } from "vitest";
import {
  compareSaturnCapturedIdentities,
  type SaturnAcrIdentityCapture,
} from "../src/modules/sources/providers/saturn/saturnEvidenceLinks.js";
import { parseSaturnPolygonJsonp } from "../src/modules/sources/providers/saturn/saturnMapEvidence.js";
import type { SaturnViewportPage } from "../src/modules/sources/providers/saturn/saturnViewportQuery.js";

const callback = "saturnCapture";
const geometry = {
  type: "Polygon",
  coordinates: [
    [
      [32.4, 55.0],
      [32.5, 55.0],
      [32.5, 55.1],
      [32.4, 55.0],
    ],
  ],
};
const otherGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [32.6, 55.0],
      [32.7, 55.0],
      [32.7, 55.1],
      [32.6, 55.0],
    ],
  ],
};

function polygon(id: string, shape: unknown = geometry): unknown {
  return { type: "Feature", id, geometry: shape };
}

function polygons(features: unknown[]) {
  return parseSaturnPolygonJsonp(
    `${callback}(${JSON.stringify({ data: { type: "FeatureCollection", features } })})`,
    callback,
  );
}

function indexEntry(
  featureId: string,
  planId = "1811436",
): SaturnViewportPage["entries"][number] {
  return { featureId, planId, centerX: 32.5, centerY: 55.0 };
}

describe("offline Saturn map-index, polygon and ACR identity comparison", () => {
  it("reports exact ID matches as candidates only and preserves shared plan IDs", () => {
    const result = compareSaturnCapturedIdentities(
      [indexEntry("238194"), indexEntry("238195"), indexEntry("238196")],
      polygons([
        polygon("238194"),
        polygon("238195"),
        polygon("2712972", otherGeometry),
      ]),
    );
    expect(result.idMatchCandidates).toEqual([
      expect.objectContaining({
        featureId: "238194",
        planId: "1811436",
        relation: "id_match_only",
      }),
      expect.objectContaining({
        featureId: "238195",
        planId: "1811436",
        relation: "id_match_only",
      }),
    ]);
    expect(result.idMatchCandidates[0].geometrySha256).toBe(
      result.idMatchCandidates[1].geometrySha256,
    );
    expect(result.sharedGeometryGroups).toEqual([
      {
        geometrySha256: result.idMatchCandidates[0].geometrySha256,
        featureIds: ["238194", "238195"],
      },
    ]);
    expect(result.indexWithoutPolygonIds).toEqual(["238196"]);
    expect(result.polygonWithoutIndexIds).toEqual(["2712972"]);
    expect(result.acrObservations).toEqual([]);
  });

  it("keeps the observed ACR URL identity distinct from its response ID", () => {
    const details: SaturnAcrIdentityCapture[] = [
      {
        requestedFeatureId: "238194",
        response: { id: 1586314, privateData: "ignored" },
      },
      { requestedFeatureId: "238195", response: { id: 238195 } },
      { requestedFeatureId: "777777", response: { id: 99 } },
    ];
    const result = compareSaturnCapturedIdentities(
      [indexEntry("238194"), indexEntry("238195")],
      polygons([polygon("238194")]),
      details,
    );
    expect(result.acrObservations).toEqual([
      {
        requestedFeatureId: "238194",
        responseId: "1586314",
        responseIdMatchesRequest: false,
        planRelation: "conflicts_with_index_plan",
        listedInIndex: true,
        listedInPolygons: true,
      },
      {
        requestedFeatureId: "238195",
        responseId: "238195",
        responseIdMatchesRequest: true,
        planRelation: "conflicts_with_index_plan",
        listedInIndex: true,
        listedInPolygons: false,
      },
      {
        requestedFeatureId: "777777",
        responseId: "99",
        responseIdMatchesRequest: false,
        planRelation: "not_in_index",
        listedInIndex: false,
        listedInPolygons: false,
      },
    ]);
    expect(result.acrObservations[0]).not.toHaveProperty("privateData");
  });

  it("recognizes a shared ACR plan ID without conflating its distinct field IDs", () => {
    // Observed field/plan ID relationships paired with synthetic polygon fixtures.
    const result = compareSaturnCapturedIdentities(
      [indexEntry("1273662", "1716288"), indexEntry("1273663", "1716288")],
      polygons([polygon("1273662"), polygon("1273663", otherGeometry)]),
      [
        { requestedFeatureId: "1273662", response: { id: 1716288 } },
        { requestedFeatureId: "1273663", response: { id: 1716288 } },
      ],
    );
    expect(result.acrObservations).toEqual([
      expect.objectContaining({
        requestedFeatureId: "1273662",
        responseId: "1716288",
        responseIdMatchesRequest: false,
        planRelation: "matches_index_plan",
        listedInPolygons: true,
      }),
      expect.objectContaining({
        requestedFeatureId: "1273663",
        responseId: "1716288",
        responseIdMatchesRequest: false,
        planRelation: "matches_index_plan",
        listedInPolygons: true,
      }),
    ]);
    expect(result.idMatchCandidates.map((item) => item.featureId)).toEqual([
      "1273662",
      "1273663",
    ]);
    expect(
      result.idMatchCandidates.every(
        (item) => item.relation === "id_match_only",
      ),
    ).toBe(true);
  });

  it("returns no implied linkage when captures have no overlapping IDs", () => {
    const result = compareSaturnCapturedIdentities(
      [indexEntry("1")],
      polygons([polygon("2")]),
    );
    expect(result.idMatchCandidates).toEqual([]);
    expect(result.indexWithoutPolygonIds).toEqual(["1"]);
    expect(result.polygonWithoutIndexIds).toEqual(["2"]);
  });

  it("rejects duplicate source identities instead of silently merging records", () => {
    const capturedPolygons = polygons([polygon("1")]);
    expect(() =>
      compareSaturnCapturedIdentities(
        [indexEntry("1"), indexEntry("1")],
        capturedPolygons,
      ),
    ).toThrow("Duplicate map-index feature ID");
    expect(() =>
      compareSaturnCapturedIdentities([indexEntry("1")], {
        ...capturedPolygons,
        polygons: [capturedPolygons.polygons[0], capturedPolygons.polygons[0]],
      }),
    ).toThrow("Duplicate polygon feature ID");
    expect(() =>
      compareSaturnCapturedIdentities([indexEntry("1")], {
        ...capturedPolygons,
        polygons: [
          { ...capturedPolygons.polygons[0], geometrySha256: "a".repeat(64) },
        ],
      }),
    ).toThrow("Polygon geometry digest does not match captured coordinates");
    expect(() =>
      compareSaturnCapturedIdentities([indexEntry("1")], capturedPolygons, [
        { requestedFeatureId: "1", response: { id: 2 } },
        { requestedFeatureId: "1", response: { id: 3 } },
      ]),
    ).toThrow("Duplicate ACR request identity");
  });

  it("fails closed on invalid IDs, incomplete ACR identities and excessive captures", () => {
    const batch = polygons([]);
    expect(() =>
      compareSaturnCapturedIdentities([indexEntry("0")], batch),
    ).toThrow();
    expect(() =>
      compareSaturnCapturedIdentities([indexEntry("1", "bad")], batch),
    ).toThrow();
    expect(() =>
      compareSaturnCapturedIdentities([], batch, [
        { requestedFeatureId: "1", response: {} },
      ]),
    ).toThrow();
    expect(() =>
      compareSaturnCapturedIdentities([], batch, [
        { requestedFeatureId: "1", response: { id: "12" } },
      ]),
    ).toThrow();
    expect(() =>
      compareSaturnCapturedIdentities(
        [],
        batch,
        Array.from({ length: 101 }, (_, i) => ({
          requestedFeatureId: String(i + 1),
          response: { id: i + 1 },
        })),
      ),
    ).toThrow("Saturn identity comparison exceeds offline limits");
  });

  it("reports empty evidence as empty, never as completed polygon coverage", () => {
    expect(compareSaturnCapturedIdentities([], polygons([]))).toEqual({
      idMatchCandidates: [],
      indexWithoutPolygonIds: [],
      polygonWithoutIndexIds: [],
      sharedGeometryGroups: [],
      acrObservations: [],
    });
  });
});
