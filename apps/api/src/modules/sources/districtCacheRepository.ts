// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { Pool, PoolClient } from "pg";
import {
  districtCoverage,
  type DistrictCacheEntry,
  type DistrictCacheCoverage,
} from "./districtCacheState.js";

export type DistrictCacheSummary = DistrictCacheEntry & {
  coverage: DistrictCacheCoverage;
};

type DistrictCacheRow = {
  source_id: string;
  source_revision: string;
  district_provider_id: number;
  filter_hash: string;
  state: DistrictCacheEntry["state"];
  next_page: number;
  pages_fetched: number;
  records_received: number;
  records_stored: number;
  total_elements: number | null;
  completed_at: Date | null;
  expires_at: Date | null;
  last_error_code: string | null;
  matches_revision: boolean;
};

function convert(row: DistrictCacheRow): DistrictCacheEntry {
  return {
    sourceId: row.source_id,
    revision: row.source_revision,
    districtId: row.district_provider_id,
    filterHash: row.filter_hash,
    state: row.state,
    nextPage: row.next_page,
    pagesFetched: row.pages_fetched,
    recordsReceived: row.records_received,
    recordsStored: row.records_stored,
    totalElements: row.total_elements,
    completedAt: row.completed_at?.toISOString() ?? null,
    expiresAt: row.expires_at?.toISOString() ?? null,
    lastErrorCode: row.last_error_code,
  };
}

/** Read-only status until a verified district request adapter is supplied. */
export class DistrictCacheRepository {
  constructor(
    private readonly db: Pick<Pool, "query">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(sourceId = "treatment-feed"): Promise<DistrictCacheSummary[]> {
    const result = await this.db.query<DistrictCacheRow>(
      `SELECT c.source_id, c.source_revision, c.district_provider_id, c.filter_hash,
              c.state, c.next_page, c.pages_fetched, c.records_received, c.records_stored,
              c.total_elements, c.completed_at, c.expires_at, c.last_error_code,
              (c.source_revision = s.registry_revision::text) AS matches_revision
       FROM source_district_cache c JOIN source_catalog s ON s.id=c.source_id
       WHERE c.source_id=$1
       ORDER BY c.district_provider_id, c.filter_hash LIMIT 100`,
      [sourceId],
    );
    return result.rows.map((row) => {
      const entry = convert(row);
      return {
        ...entry,
        coverage: row.matches_revision
          ? districtCoverage(entry, this.now())
          : "stale",
      };
    });
  }

  /**
   * Persist page progress inside the same transaction that stores its source evidence.
   *
   * @param client - Already active evidence transaction; this method does not commit it.
   * @param entry - Updated result of advanceDistrictCache for the exact filter key.
   * @throws Error if no matching running district job exists.
   */
  async recordPage(
    client: PoolClient,
    entry: DistrictCacheEntry,
  ): Promise<void> {
    const result = await client.query(
      `UPDATE source_district_cache SET state=$5, next_page=$6, pages_fetched=$7,
         records_received=$8, records_stored=$9, completed_at=$10,
         expires_at=$11, last_error_code=$12, updated_at=now()
       WHERE source_id=$1 AND source_revision=$2 AND district_provider_id=$3
         AND filter_hash=$4 AND state='running' AND pages_fetched=$7 - 1`,
      [
        entry.sourceId,
        entry.revision,
        entry.districtId,
        entry.filterHash,
        entry.state,
        entry.nextPage,
        entry.pagesFetched,
        entry.recordsReceived,
        entry.recordsStored,
        entry.completedAt,
        entry.expiresAt,
        entry.lastErrorCode,
      ],
    );
    if (result.rowCount !== 1)
      throw new Error("District job changed during evidence transaction");
  }
}
