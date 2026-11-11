// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  SaturnPolygonBatch,
  SaturnPolygonGeometry,
} from "./saturnMapEvidence.js";
import {
  SATURN_MAX_ACR_CAPTURE_FILES,
  SATURN_MAX_POLYGON_FEATURES,
  SATURN_MAX_VIEWPORT_ELEMENTS,
} from "./sourceProfile.js";
import type { SaturnViewportPage } from "./saturnViewportQuery.js";

const providerIdSchema = z.string().regex(/^[1-9][0-9]{0,19}$/);
const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const minimalAcrIdentitySchema = z.object({
  id: z.number().int().positive().safe(),
});

enum SaturnIdentityRelation {
  IdMatchOnly = "id_match_only",
  IdAndPlanMatchOnly = "id_and_plan_match_candidate_only",
}

enum SaturnAcrPlanRelation {
  MatchesIndexPlan = "matches_index_plan",
  ConflictsWithIndexPlan = "conflicts_with_index_plan",
  NotInIndex = "not_in_index",
}

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
    /** Bbox containment is a weak plausibility check, not a polygon join. */
    indexCenterWithinPolygonBounds: boolean;
    relation: `${SaturnIdentityRelation.IdMatchOnly}`;
  }>;
  /** Three matching identifiers are still only a candidate across captures. */
  threeEndpointCandidates: Array<{
    featureId: string;
    planId: string;
    geometrySha256: string;
    indexCenterWithinPolygonBounds: boolean;
    relation: `${SaturnIdentityRelation.IdAndPlanMatchOnly}`;
  }>;
  indexWithoutPolygonIds: string[];
  polygonWithoutIndexIds: string[];
  sharedGeometryGroups: Array<{ geometrySha256: string; featureIds: string[] }>;
  acrObservations: Array<{
    requestedFeatureId: string;
    responseId: string;
    responseIdMatchesRequest: boolean;
    /** The ACR body ID may name the shared plan, not the requested field. */
    planRelation: `${SaturnAcrPlanRelation}`;
    listedInIndex: boolean;
    listedInPolygons: boolean;
  }>;
};

/** An exterior bounding box includes holes and empty gaps in MultiPolygons. */
function geometryContainsCenterInBounds(
  geometry: SaturnPolygonGeometry,
  longitude: number,
  latitude: number,
): boolean {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        west = Math.min(west, x);
        south = Math.min(south, y);
        east = Math.max(east, x);
        north = Math.max(north, y);
      }
    }
  }
  return (
    west <= longitude &&
    longitude <= east &&
    south <= latitude &&
    latitude <= north
  );
}

/**
 * Compare independently captured map IDs without establishing source joins.
 * A matching `Feature.id` in two captures is only an investigative candidate:
 * viewport/zoom, capture time, provider identity and publication rights may
 * differ. An `/acr/{id}` response ID is a separate identity from its URL ID.
 * Compare that body ID with the indexed plan ID, not with the field ID, while
 * keeping both consistent and conflicting cases unverified until capture
 * provenance, treatment data and geometry are independently reconciled.
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
    polygonBatch.polygons.length > SATURN_MAX_POLYGON_FEATURES ||
    acrCaptures.length > SATURN_MAX_ACR_CAPTURE_FILES
  ) {
    throw new Error("Saturn identity comparison exceeds offline limits");
  }

  const indexById = new Map<
    string,
    { planId: string; centerX: number; centerY: number }
  >();
  for (const entry of indexEntries) {
    const featureId = providerIdSchema.parse(entry.featureId);
    const planId = providerIdSchema.parse(entry.planId);
    if (indexById.has(featureId)) {
      throw new Error("Duplicate map-index feature ID");
    }
    if (!Number.isFinite(entry.centerX) || !Number.isFinite(entry.centerY)) {
      throw new Error("Invalid map-index center coordinates");
    }
    indexById.set(featureId, {
      planId,
      centerX: entry.centerX,
      centerY: entry.centerY,
    });
  }

  const polygonById = new Map<
    string,
    { geometrySha256: string; geometry: SaturnPolygonGeometry }
  >();
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
    polygonById.set(featureId, {
      geometrySha256: digest,
      geometry: polygon.geometry,
    });
    geometryGroups.set(digest, [
      ...(geometryGroups.get(digest) ?? []),
      featureId,
    ]);
  }

  const idMatchCandidates: SaturnIdentityComparison["idMatchCandidates"] = [
    ...indexById,
  ].flatMap(([featureId, indexed]) => {
    const polygon = polygonById.get(featureId);
    return polygon
      ? [
          {
            featureId,
            planId: indexed.planId,
            geometrySha256: polygon.geometrySha256,
            indexCenterWithinPolygonBounds: geometryContainsCenterInBounds(
              polygon.geometry,
              indexed.centerX,
              indexed.centerY,
            ),
            relation: SaturnIdentityRelation.IdMatchOnly,
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
    const indexedPlanId = indexById.get(requestedFeatureId)?.planId;
    const planRelation =
      indexedPlanId === undefined
        ? SaturnAcrPlanRelation.NotInIndex
        : responseId === indexedPlanId
          ? SaturnAcrPlanRelation.MatchesIndexPlan
          : SaturnAcrPlanRelation.ConflictsWithIndexPlan;
    return {
      requestedFeatureId,
      responseId,
      responseIdMatchesRequest: responseId === requestedFeatureId,
      planRelation,
      listedInIndex: indexById.has(requestedFeatureId),
      listedInPolygons: polygonById.has(requestedFeatureId),
    };
  });

  const acrPlanMatches = new Set(
    acrObservations
      .filter(
        (capture) =>
          capture.planRelation === SaturnAcrPlanRelation.MatchesIndexPlan,
      )
      .map((capture) => capture.requestedFeatureId),
  );
  const threeEndpointCandidates: SaturnIdentityComparison["threeEndpointCandidates"] =
    idMatchCandidates
      .filter((candidate) => acrPlanMatches.has(candidate.featureId))
      .map(
        ({
          featureId,
          planId,
          geometrySha256,
          indexCenterWithinPolygonBounds,
        }) => ({
          featureId,
          planId,
          geometrySha256,
          indexCenterWithinPolygonBounds,
          relation: SaturnIdentityRelation.IdAndPlanMatchOnly,
        }),
      );

  return {
    idMatchCandidates,
    threeEndpointCandidates,
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
