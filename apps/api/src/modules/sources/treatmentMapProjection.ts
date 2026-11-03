// Feature IDs: NOTICES.MAP_OVERLAY, NOTICES.SPATIAL_PRECISION
import type { Pool } from "pg";
import type { BeekeeperPlan } from "./beekeeperPlanPage.js";

export type MapTreatment = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  publishedAt: string | null;
  startAt: string | null;
  endAt: string | null;
  contractorName: string | null;
  cadastralNumber: string | null;
  treatments: BeekeeperPlan["treatments"];
  geometry: NonNullable<BeekeeperPlan["geometry"]>;
  spatialPrecision: "exact_polygon";
  reviewStatus?: "pending" | "verified";
};

/** Drop malformed persisted treatment attributes instead of trusting a JSONB type assertion. */
function sanitizeStoredTreatments(value: unknown): BeekeeperPlan["treatments"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate: unknown) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return [];
    const item = candidate as Record<string, unknown>;
    if (
      !(item.name === null || typeof item.name === "string") ||
      !(item.crop === null || typeof item.crop === "string") ||
      !(
        item.beeHazardClass === null ||
        item.beeHazardClass === 1 ||
        item.beeHazardClass === 2 ||
        item.beeHazardClass === 3
      )
    )
      return [];
    return [
      {
        name: item.name as string | null,
        crop: item.crop as string | null,
        beeHazardClass: item.beeHazardClass as 1 | 2 | 3 | null,
      },
    ];
  });
}

export async function listStoredMapTreatments(
  pool: Pick<Pool, "query">,
  sourceId: string,
  includePending: boolean,
  bbox?: [number, number, number, number],
): Promise<MapTreatment[]> {
  const result = await pool.query<{
    id: string;
    name: string;
    canonical_url: string;
    retrieved_at: Date;
    published_at: Date | null;
    start_at: Date | null;
    end_at: Date | null;
    attributes: Record<string, unknown>;
    geometry: unknown;
    review_status: "pending" | "verified";
  }>(
    `WITH latest AS (
         SELECT DISTINCT ON (COALESCE(NULLIF(o.attributes->>'externalId', ''), o.id::text))
           o.id, s.name, d.canonical_url, d.last_seen_at AS retrieved_at, d.published_at,
           o.start_at, o.end_at, o.attributes, o.review_status, o.extraction_method,
           o.geometry, o.spatial_precision
         FROM source_observations o JOIN source_documents d ON d.id=o.source_document_id
         JOIN source_catalog s ON s.id=d.source_id
         WHERE d.source_id=$1 AND s.lifecycle='configured' AND d.canonical_url=s.url
           AND o.observation_type='treatment_plan'
         ORDER BY COALESCE(NULLIF(o.attributes->>'externalId', ''), o.id::text),
           d.last_seen_at DESC, d.retrieved_at DESC, o.created_at DESC, o.id DESC
       )
       SELECT id, name, canonical_url, retrieved_at, published_at, start_at, end_at,
         attributes, review_status, ST_AsGeoJSON(geometry)::json AS geometry
       FROM latest WHERE (review_status='verified' OR
         (review_status='pending' AND ($6::boolean OR extraction_method='structured')))
         AND geometry IS NOT NULL AND spatial_precision='exact_polygon'
         AND ST_GeometryType(geometry) IN ('ST_Polygon', 'ST_MultiPolygon')
         AND ST_IsValid(geometry)
         AND ($2::float8 IS NULL OR ST_Intersects(geometry,ST_MakeEnvelope($2,$3,$4,$5,4326)))
       ORDER BY retrieved_at DESC, id LIMIT 200`,
    [sourceId, ...(bbox ?? [null, null, null, null]), includePending],
  );
  return result.rows.map((r) => ({
    id: r.id,
    sourceName:
      typeof r.attributes.sourceName === "string"
        ? r.attributes.sourceName
        : r.name,
    sourceUrl: r.canonical_url,
    retrievedAt: r.retrieved_at.toISOString(),
    publishedAt: r.published_at?.toISOString() ?? null,
    startAt: r.start_at?.toISOString() ?? null,
    endAt: r.end_at?.toISOString() ?? null,
    contractorName:
      typeof r.attributes.contractorName === "string"
        ? r.attributes.contractorName
        : null,
    cadastralNumber:
      typeof r.attributes.cadastralNumber === "string"
        ? r.attributes.cadastralNumber
        : null,
    treatments: sanitizeStoredTreatments(r.attributes.treatments),
    geometry: r.geometry as MapTreatment["geometry"],
    spatialPrecision: "exact_polygon",
    reviewStatus: r.review_status,
  }));
}
