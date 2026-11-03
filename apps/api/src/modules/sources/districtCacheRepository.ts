// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  DISTRICT_LEASE_MINUTES,
  MAX_DISTRICT_PAGES,
  districtCoverage,
  type DistrictCacheEntry,
  type DistrictCacheCoverage,
  type DistrictCacheKey,
} from "./districtCacheState.js";

export type DistrictCacheSummary = DistrictCacheEntry & {
  coverage: DistrictCacheCoverage;
};

export type DistrictCacheClaim = {
  entry: DistrictCacheEntry;
  leaseToken: string;
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
  lease_expires_at: Date | null;
  matches_revision?: boolean;
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

/** District jobs are inert until a verified provider request adapter is connected. */
export class DistrictCacheRepository {
  constructor(
    private readonly db: Pool,
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
   * Claim the exact district/filter key without stealing a live worker lease.
   *
   * @param key - Previously verified provider district/filter identity.
   * @param force - Bypass an unexpired completed TTL, never an active lease.
   * @returns Owner token and next page, or null if active/fresh.
   * @throws Error if the source revision has changed or a page cap was reached.
   */
  async claim(
    key: DistrictCacheKey,
    force = false,
  ): Promise<DistrictCacheClaim | null> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const source = await client.query<{
        registry_revision: string;
        lifecycle: string;
      }>(
        `SELECT registry_revision::text, lifecycle FROM source_catalog
         WHERE id=$1 FOR SHARE`,
        [key.sourceId],
      );
      if (
        source.rows[0]?.registry_revision !== key.revision ||
        source.rows[0]?.lifecycle !== "configured"
      ) {
        throw new Error("District source revision is not configured");
      }
      await client.query(
        `INSERT INTO source_district_cache
           (source_id, source_revision, district_provider_id, filter_hash, state)
         VALUES ($1, $2, $3, $4, 'paused') ON CONFLICT DO NOTHING`,
        [key.sourceId, key.revision, key.districtId, key.filterHash],
      );
      const result = await client.query<DistrictCacheRow>(
        `SELECT * FROM source_district_cache
         WHERE source_id=$1 AND source_revision=$2
           AND district_provider_id=$3 AND filter_hash=$4 FOR UPDATE`,
        [key.sourceId, key.revision, key.districtId, key.filterHash],
      );
      const row = result.rows[0];
      if (!row) throw new Error("District cache claim row missing");
      const current = convert(row);
      const now = this.now();
      const owned =
        row.state === "running" &&
        row.lease_expires_at !== null &&
        row.lease_expires_at.getTime() > now.getTime();
      const fresh = districtCoverage(current, now) === "fresh";
      if (owned || (fresh && !force)) {
        await client.query("COMMIT");
        return null;
      }
      if (current.nextPage >= MAX_DISTRICT_PAGES) {
        throw new Error("District page cap reached");
      }
      const resume =
        current.state !== "completed" &&
        current.pagesFetched > 0 &&
        current.nextPage > 0;
      const leaseToken = randomUUID();
      const leaseUntil = new Date(
        now.getTime() + DISTRICT_LEASE_MINUTES * 60_000,
      );
      await client.query(
        `UPDATE source_district_cache SET state='running',
           next_page=CASE WHEN $5 THEN next_page ELSE 0 END,
           pages_fetched=CASE WHEN $5 THEN pages_fetched ELSE 0 END,
           records_received=CASE WHEN $5 THEN records_received ELSE 0 END,
           records_stored=CASE WHEN $5 THEN records_stored ELSE 0 END,
           total_elements=CASE WHEN $5 THEN total_elements ELSE NULL END,
           last_error_code=NULL, lease_token=$6::uuid, lease_expires_at=$7,
           updated_at=now()
         WHERE source_id=$1 AND source_revision=$2
           AND district_provider_id=$3 AND filter_hash=$4`,
        [
          key.sourceId,
          key.revision,
          key.districtId,
          key.filterHash,
          resume,
          leaseToken,
          leaseUntil,
        ],
      );
      await client.query("COMMIT");
      return {
        leaseToken,
        entry: {
          ...current,
          state: "running",
          nextPage: resume ? current.nextPage : 0,
          pagesFetched: resume ? current.pagesFetched : 0,
          recordsReceived: resume ? current.recordsReceived : 0,
          recordsStored: resume ? current.recordsStored : 0,
          totalElements: resume ? current.totalElements : null,
          lastErrorCode: null,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Persist evidence-page progress in the caller's existing evidence transaction.
   *
   * @param client - Active evidence transaction, never committed here.
   * @param entry - Result of advanceDistrictCache for the claimed page.
   * @param leaseToken - Current claim token, rejecting stale competing workers.
   * @throws Error if the row was reclaimed or its page progress changed.
   */
  async recordPage(
    client: PoolClient,
    entry: DistrictCacheEntry,
    leaseToken: string,
  ): Promise<void> {
    const result = await client.query(
      `UPDATE source_district_cache SET state=$5, next_page=$6, pages_fetched=$7,
         records_received=$8, records_stored=$9, completed_at=$10,
         expires_at=$11, last_error_code=$12,
         lease_token=CASE WHEN $5='running' THEN lease_token ELSE NULL END,
         lease_expires_at=CASE WHEN $5='running'
           THEN $14::timestamptz ELSE NULL END, updated_at=now()
       WHERE source_id=$1 AND source_revision=$2 AND district_provider_id=$3
         AND filter_hash=$4 AND state='running' AND pages_fetched=$7 - 1
         AND lease_token=$13::uuid`,
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
        leaseToken,
        new Date(this.now().getTime() + DISTRICT_LEASE_MINUTES * 60_000),
      ],
    );
    if (result.rowCount !== 1)
      throw new Error("District job changed during evidence transaction");
  }

  /** Preserve evidence and last complete coverage when an owned fetch fails. */
  async fail(
    key: DistrictCacheKey,
    leaseToken: string,
    errorCode: string,
  ): Promise<boolean> {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(errorCode))
      throw new Error("Invalid sanitized district error code");
    const result = await this.db.query(
      `UPDATE source_district_cache SET state='failed',
         last_error_code=$6, lease_token=NULL, lease_expires_at=NULL,
         updated_at=now()
       WHERE source_id=$1 AND source_revision=$2 AND district_provider_id=$3
         AND filter_hash=$4 AND state='running' AND lease_token=$5::uuid`,
      [
        key.sourceId,
        key.revision,
        key.districtId,
        key.filterHash,
        leaseToken,
        errorCode,
      ],
    );
    return result.rowCount === 1;
  }
}
