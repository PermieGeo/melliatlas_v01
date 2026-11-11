// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { Pool } from "pg";
import {
  saturnDistrictPointsResponseSchema,
  saturnStoredFieldsResponseSchema,
  type SaturnDistrictPointsResponse,
  type SaturnStoredFieldsResponse,
} from "@melliatlas/contracts";
import {
  SATURN_DISTRICT_PREVIEW_LIMIT,
  SATURN_INDEX_PREVIEW_LIMIT,
  SATURN_SOURCE_ID,
} from "./sourceProfile.js";

/** Read-only previews of already saved field centers; no upstream requests or treatment assertions. */
export class SaturnStoredIndex {
  constructor(private readonly db: Pick<Pool, "query">) {}

  /** Combine saved filter snapshots by provider district; do not infer coverage. */
  async districtPoints(
    regionCode: string,
    districtId: number,
  ): Promise<SaturnDistrictPointsResponse> {
    if (!Number.isSafeInteger(districtId) || districtId < 1)
      throw new Error("Invalid Saturn district ID");
    if (!/^[1-9][0-9]{0,5}$/.test(regionCode))
      throw new Error("Invalid Saturn region code");
    const args = [SATURN_SOURCE_ID, regionCode, districtId];
    const [count, result] = await Promise.all([
      this.db.query<{ count: string }>(
        `SELECT COUNT(DISTINCT f.feature_id)::text AS count
         FROM source_viewport_index_features f
         JOIN source_viewport_index_progress v USING (source_id, source_revision, request_hash)
         WHERE f.source_id=$1 AND v.first_request->'filter'->>'subject'=$2 AND v.district_provider_id=$3`,
        args,
      ),
      this.db.query<{
        feature_id: string;
        plan_id: string;
        center_x: number;
        center_y: number;
      }>(
        `SELECT DISTINCT ON (f.feature_id) f.feature_id::text, f.plan_id::text,
           ST_X(f.center) AS center_x, ST_Y(f.center) AS center_y
         FROM source_viewport_index_features f
         JOIN source_viewport_index_progress v USING (source_id, source_revision, request_hash)
         WHERE f.source_id=$1 AND v.first_request->'filter'->>'subject'=$2 AND v.district_provider_id=$3
         ORDER BY f.feature_id, v.updated_at DESC LIMIT $4`,
        [...args, SATURN_DISTRICT_PREVIEW_LIMIT],
      ),
    ]);
    return saturnDistrictPointsResponseSchema.parse({
      totalKnown: Number(count.rows[0]?.count ?? 0),
      centers: result.rows.map((row) => ({
        featureId: row.feature_id,
        planId: row.plan_id,
        centerX: row.center_x,
        centerY: row.center_y,
      })),
    });
  }

  /** Inspect one saved request filter, not live treatment geometry or details. */
  async requestFields(
    requestHash: string,
  ): Promise<SaturnStoredFieldsResponse> {
    if (!/^[a-f0-9]{64}$/.test(requestHash))
      throw new Error("Invalid viewport request hash");
    const result = await this.db.query<{
      feature_id: string;
      plan_id: string;
      center_x: number;
      center_y: number;
    }>(
      `SELECT f.feature_id::text, f.plan_id::text,
         ST_X(f.center) AS center_x, ST_Y(f.center) AS center_y
       FROM source_viewport_index_features f
       JOIN source_viewport_index_progress v USING (source_id, source_revision, request_hash)
       WHERE f.source_id=$1 AND v.request_hash=$2
       ORDER BY f.page_number, f.feature_id LIMIT $3`,
      [SATURN_SOURCE_ID, requestHash, SATURN_INDEX_PREVIEW_LIMIT],
    );
    return saturnStoredFieldsResponseSchema.parse({
      centers: result.rows.map((row) => ({
        featureId: row.feature_id,
        planId: row.plan_id,
        centerX: row.center_x,
        centerY: row.center_y,
      })),
    });
  }
}
