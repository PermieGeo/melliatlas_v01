// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { Pool } from "pg";
import {
  viewportCacheHistoryResponseSchema,
  type ViewportCacheHistoryResponse,
} from "@melliatlas/contracts";
import { validateSaturnViewportQuery } from "./saturnViewportQuery.js";
import {
  SATURN_HISTORY_LIMIT,
  SATURN_HISTORY_PAGE_RECEIPTS_LIMIT,
  SATURN_SOURCE_ID,
  SaturnViewportState,
} from "./sourceProfile.js";

type HistoryRow = {
  first_request: unknown;
  request_hash: string;
  source_revision: string;
  district_provider_id: number;
  state: `${SaturnViewportState}`;
  pages_fetched: number;
  entries_received: number;
  total_pages: number | null;
  updated_at: Date;
  source_revision_current: boolean;
  recent_pages: unknown;
};

/** Read bounded saved index checkpoints across map and operator actions, never provider data. */
export async function listViewportCacheHistory(
  db: Pick<Pool, "query">,
): Promise<ViewportCacheHistoryResponse> {
  const result = await db.query<HistoryRow>(
    `SELECT v.first_request, v.request_hash, v.source_revision, v.district_provider_id,
       v.state, v.pages_fetched, v.entries_received, v.total_pages, v.updated_at,
       (s.registry_revision::text = v.source_revision) AS source_revision_current,
       COALESCE((
         SELECT json_agg(json_build_object(
           'pageNumber', p.page_number,
           'storedAt', to_char(p.stored_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'recordCount', jsonb_array_length(p.response_json -> 'content'))
           ORDER BY p.page_number DESC)
         FROM (SELECT page_number, stored_at, response_json FROM source_viewport_index_pages
           WHERE source_id=v.source_id AND source_revision=v.source_revision
             AND request_hash=v.request_hash
           ORDER BY page_number DESC LIMIT $2) p
       ), '[]'::json) AS recent_pages
     FROM source_viewport_index_progress v
     JOIN source_catalog s ON s.id=v.source_id
     WHERE v.source_id=$1
     ORDER BY v.updated_at DESC, v.request_hash DESC
     LIMIT $3`,
    [
      SATURN_SOURCE_ID,
      SATURN_HISTORY_PAGE_RECEIPTS_LIMIT,
      SATURN_HISTORY_LIMIT,
    ],
  );
  const entries = result.rows.map((row) => {
    const query = validateSaturnViewportQuery(row.first_request);
    return {
      requestHash: row.request_hash.trim(),
      sourceRevision: row.source_revision,
      sourceRevisionCurrent: row.source_revision_current,
      regionCode: query.filter.subject,
      districtId: row.district_provider_id,
      bbox: {
        west: query.filter.leftTop.longitude,
        north: query.filter.leftTop.latitude,
        east: query.filter.rightDown.longitude,
        south: query.filter.rightDown.latitude,
      },
      fromDate: query.filter.startDateUpdateMap.slice(0, 10),
      toDate: query.filter.endDateUpdateMap.slice(0, 10),
      state: row.state,
      pagesFetched: row.pages_fetched,
      entriesReceived: row.entries_received,
      totalPages: row.total_pages,
      updatedAt: row.updated_at.toISOString(),
      recentPages: row.recent_pages,
    };
  });
  return viewportCacheHistoryResponseSchema.parse({ entries });
}
