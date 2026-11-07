// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SaturnPolygonBatch } from "./saturnMapEvidence.js";
import { SATURN_MAX_VIEWPORT_ELEMENTS } from "./sourceProfile.js";
import type { SaturnViewportPage } from "./saturnViewportQuery.js";

const providerIdSchema = z.string().regex(/^[1-9][0-9]{0,19}$/);
const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const minimalAcrIdentitySchema = z.object({
  id: z.number().int().positive().safe(),
});
const MAX_POLYGON_EVIDENCE = 2_000;
const MAX_ACR_OBSERVATIONS = 100;

export type SaturnAcrIdentityCapture = {
  requestedFeatureId: string;
  response: unknown;
};

export type SaturnIdentityComparison = {
  /** Identical feature IDs suggest a candidate join, not a verified association. */
  idMatchCandidates: Array<{
    featureId: string;
    planId: string;
    geometrySha256: string;
    relation: "id_match_only";
  }>;
  indexWithoutPolygonIds: string[];
  polygonWithoutIndexIds: string[];
  sharedGeometryGroups: Array<{ geometrySha256: string; featureIds: string[] }>;
  acrObservations: Array<{
    requestedFeatureId: string;
    responseId: string;
    responseIdMatchesRequest: boolean;
    listedInIndex: boolean;
    listedInPolygons: boolean;
  }>;
};

/**
 * Compare independently captured map IDs without establishing source joins.
 * A matching `Feature.id` in two captures is only an investigative candidate:
 * viewport/zoom, capture time, provider identity and publication rights may
 * differ. An `/acr/{id}` response ID is a separate identity from its URL ID.
 * No geometry is persisted, published, or associated with a treatment here.
 *
 * @throws Error if an input contains duplicated, unbounded or malformed IDs.
 */
export function compareSaturnCapturedIdentities(
  indexEntries: readonly SaturnViewportPage["entries"][number][],
  polygonBatch: SaturnPolygonBatch,
  acrCaptures: readonly SaturnAcrIdentityCapture[] = [],
): SaturnIdentityComparison {
  if (
    indexEntries.length > SATURN_MAX_VIEWPORT_ELEMENTS ||
    polygonBatch.polygons.length > MAX_POLYGON_EVIDENCE ||
    acrCaptures.length > MAX_ACR_OBSERVATIONS
  ) {
    throw new Error("Saturn identity comparison exceeds offline limits");
  }

  const indexById = new Map<string, string>();
  for (const entry of indexEntries) {
    const featureId = providerIdSchema.parse(entry.featureId);
    const planId = providerIdSchema.parse(entry.planId);
    if (indexById.has(featureId)) {
      throw new Error("Duplicate map-index feature ID");
    }
    indexById.set(featureId, planId);
  }

  const polygonById = new Map<string, string>();
  const geometryGroups = new Map<string, string[]>();
  for (const polygon of polygonBatch.polygons) {
    const featureId = providerIdSchema.parse(polygon.featureId);
    const digest = digestSchema.parse(polygon.geometrySha256);
    const actualDigest = createHash("sha256")
      .update(JSON.stringify(polygon.geometry))
      .digest("hex");
    if (digest !== actualDigest) {
      throw new Error(
        "Polygon geometry digest does not match captured coordinates",
      );
    }
    if (polygonById.has(featureId)) {
      throw new Error("Duplicate polygon feature ID");
    }
    polygonById.set(featureId, digest);
    geometryGroups.set(digest, [
      ...(geometryGroups.get(digest) ?? []),
      featureId,
    ]);
  }

  const idMatchCandidates = [...indexById].flatMap(([featureId, planId]) => {
    const geometrySha256 = polygonById.get(featureId);
    return geometrySha256
      ? [
          {
            featureId,
            planId,
            geometrySha256,
            relation: "id_match_only" as const,
          },
        ]
      : [];
  });

  const seenCaptures = new Set<string>();
  const acrObservations = acrCaptures.map((capture) => {
    const requestedFeatureId = providerIdSchema.parse(
      capture.requestedFeatureId,
    );
    if (seenCaptures.has(requestedFeatureId)) {
      throw new Error("Duplicate ACR request identity");
    }
    seenCaptures.add(requestedFeatureId);
    const responseId = String(
      minimalAcrIdentitySchema.parse(capture.response).id,
    );
    return {
      requestedFeatureId,
      responseId,
      responseIdMatchesRequest: responseId === requestedFeatureId,
      listedInIndex: indexById.has(requestedFeatureId),
      listedInPolygons: polygonById.has(requestedFeatureId),
    };
  });

  return {
    idMatchCandidates,
    indexWithoutPolygonIds: [...indexById.keys()].filter(
      (id) => !polygonById.has(id),
    ),
    polygonWithoutIndexIds: [...polygonById.keys()].filter(
      (id) => !indexById.has(id),
    ),
    sharedGeometryGroups: [...geometryGroups]
      .filter(([, featureIds]) => featureIds.length > 1)
      .map(([geometrySha256, featureIds]) => ({ geometrySha256, featureIds })),
    acrObservations,
  };
}
