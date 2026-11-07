// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  parseSaturnViewportPage,
  validateSaturnViewportQuery,
  type SaturnViewportQuery,
} from "./saturnViewportQuery.js";

export type ViewportIndexKey = {
  sourceId: string;
  sourceRevision: string;
  firstPageRequest: SaturnViewportQuery;
};

export type ViewportIndexStatus = {
  requestHash: string;
  state: "partial" | "viewport_index_complete";
  nextPage: number | null;
  pagesFetched: number;
  entriesReceived: number;
  totalPages: number | null;
  totalElements: number | null;
  completedAt: string | null;
  sourceRevisionCurrent: boolean;
};

export type StoredViewportFeature = {
  featureId: string;
  planId: string;
  centerX: number;
  centerY: number;
};

type Row = {
  request_hash: string;
  state: ViewportIndexStatus["state"];
  next_page: number | null;
  pages_fetched: number;
  entries_received: number;
  total_pages: number | null;
  total_elements: number | null;
  completed_at: Date | null;
  source_revision_current: boolean;
};

function validateKey(key: ViewportIndexKey): {
  request: SaturnViewportQuery;
  hash: string;
} {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(key.sourceId) ||
    !/^[1-9][0-9]{0,17}$/.test(key.sourceRevision)
  ) {
    throw new Error("Invalid viewport source identity");
  }
  const request = validateSaturnViewportQuery(key.firstPageRequest);
  if (request.pageNumber !== 0)
    throw new Error("Viewport key must start at page zero");
  const hash = createHash("sha256")
    .update(JSON.stringify(request))
    .digest("hex");
  return { request, hash };
}

function toStatus(row: Row): ViewportIndexStatus {
  return {
    requestHash: row.request_hash.trim(),
    state: row.state,
    nextPage: row.next_page,
    pagesFetched: row.pages_fetched,
    entriesReceived: row.entries_received,
    totalPages: row.total_pages,
    totalElements: row.total_elements,
    completedAt: row.completed_at?.toISOString() ?? null,
    sourceRevisionCurrent: row.source_revision_current,
  };
}

const statusSelect = `SELECT v.request_hash, v.state, v.next_page,
  v.pages_fetched, v.entries_received, v.total_pages, v.total_elements,
  v.completed_at, (s.registry_revision::text = v.source_revision)
    AS source_revision_current
  FROM source_viewport_index_progress v
  JOIN source_catalog s ON s.id = v.source_id
  WHERE v.source_id = $1 AND v.source_revision = $2 AND v.request_hash = $3`;

/** Persist captured Saturn map-index pages only; this module never contacts the provider. */
export class SaturnViewportIndexRepository {
  constructor(private readonly db: Pool) {}

  /** Read resumable progress without inferring district or treatment coverage. */
  async getStatus(key: ViewportIndexKey): Promise<ViewportIndexStatus | null> {
    const { hash } = validateKey(key);
    const result = await this.db.query<Row>(statusSelect, [
      key.sourceId,
      key.sourceRevision,
      hash,
    ]);
    return result.rows[0] ? toStatus(result.rows[0]) : null;
  }

  /** Read only saved center points; neither exact field geometry nor spray evidence. */
  async listFeatures(key: ViewportIndexKey): Promise<StoredViewportFeature[]> {
    const { hash } = validateKey(key);
    const result = await this.db.query<{
      feature_id: string;
      plan_id: string;
      center_x: number;
      center_y: number;
    }>(
      `SELECT feature_id::text, plan_id::text, ST_X(center) AS center_x,
              ST_Y(center) AS center_y
       FROM source_viewport_index_features
       WHERE source_id=$1 AND source_revision=$2 AND request_hash=$3
       ORDER BY page_number, feature_id`,
      [key.sourceId, key.sourceRevision, hash],
    );
    return result.rows.map((row) => ({
      featureId: row.feature_id,
      planId: row.plan_id,
      centerX: row.center_x,
      centerY: row.center_y,
    }));
  }

  /**
   * Atomically record exactly the expected next captured page and its indexed points.
   * A restart resumes from getStatus(). No HTTP access, district freshness or publication follows.
   *
   * @throws Error for stale source revisions, duplicate IDs, inconsistent pages, or completed keys.
   */
  async appendCapturedPage(
    key: ViewportIndexKey,
    response: unknown,
  ): Promise<ViewportIndexStatus> {
    const { request, hash } = validateKey(key);
    const json = JSON.stringify(response);
    if (
      typeof json !== "string" ||
      Buffer.byteLength(json, "utf8") > 1_000_000
    ) {
      throw new Error("Viewport response is not bounded JSON");
    }
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await this.assertCurrentSource(client, key);
      await client.query(
        `INSERT INTO source_viewport_index_progress
          (source_id, source_revision, request_hash, first_request,
           district_provider_id, next_page)
         VALUES ($1,$2,$3,$4::jsonb,$5,0) ON CONFLICT DO NOTHING`,
        [
          key.sourceId,
          key.sourceRevision,
          hash,
          JSON.stringify(request),
          Number(request.filter.district),
        ],
      );
      const result = await client.query<
        Row & { first_request: SaturnViewportQuery }
      >(
        `${statusSelect.replace("SELECT v.request_hash", "SELECT v.first_request, v.request_hash")}
         FOR UPDATE OF v`,
        [key.sourceId, key.sourceRevision, hash],
      );
      const current = result.rows[0];
      if (
        !current ||
        JSON.stringify(validateSaturnViewportQuery(current.first_request)) !==
          JSON.stringify(request)
      ) {
        throw new Error("Viewport index filter identity changed");
      }
      if (current.next_page === null || current.state !== "partial") {
        throw new Error("Viewport index already complete");
      }
      const page = parseSaturnViewportPage(response, {
        ...request,
        pageNumber: current.next_page,
      });
      if (
        (current.total_pages !== null &&
          current.total_pages !== page.totalPages) ||
        (current.total_elements !== null &&
          current.total_elements !== page.totalElements) ||
        page.totalPages > 2000 ||
        page.totalElements > 20000 ||
        (page.nextPage === null &&
          current.entries_received + page.entries.length !== page.totalElements)
      ) {
        throw new Error("Viewport pagination changed or is incomplete");
      }
      const digest = createHash("sha256").update(json).digest("hex");
      await client.query(
        `INSERT INTO source_viewport_index_pages
         (source_id, source_revision, request_hash, page_number, response_text, response_json, response_sha256)
         VALUES ($1,$2,$3,$4,$5::text,$6::jsonb,$7)`,
        [
          key.sourceId,
          key.sourceRevision,
          hash,
          page.pageNumber,
          json,
          json,
          digest,
        ],
      );
      for (const entry of page.entries) {
        await client.query(
          `INSERT INTO source_viewport_index_features
           (source_id, source_revision, request_hash, page_number, feature_id, plan_id, center)
           VALUES ($1,$2,$3,$4,$5::bigint,$6::bigint,
                   ST_SetSRID(ST_MakePoint($7,$8),4326))`,
          [
            key.sourceId,
            key.sourceRevision,
            hash,
            page.pageNumber,
            entry.featureId,
            entry.planId,
            entry.centerX,
            entry.centerY,
          ],
        );
      }
      await client.query(
        `UPDATE source_viewport_index_progress SET
           state=$4, next_page=$5, pages_fetched=pages_fetched+1,
           entries_received=entries_received+$6, total_pages=$7, total_elements=$8,
           completed_at=CASE WHEN $5::integer IS NULL THEN now() ELSE NULL END,
           updated_at=now()
         WHERE source_id=$1 AND source_revision=$2 AND request_hash=$3`,
        [
          key.sourceId,
          key.sourceRevision,
          hash,
          page.nextPage === null ? "viewport_index_complete" : "partial",
          page.nextPage,
          page.entries.length,
          page.totalPages,
          page.totalElements,
        ],
      );
      const saved = await client.query<Row>(statusSelect, [
        key.sourceId,
        key.sourceRevision,
        hash,
      ]);
      await client.query("COMMIT");
      if (!saved.rows[0]) throw new Error("Viewport index checkpoint missing");
      return toStatus(saved.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async assertCurrentSource(
    client: PoolClient,
    key: ViewportIndexKey,
  ): Promise<void> {
    const source = await client.query<{
      registry_revision: string;
      kind: string;
      lifecycle: string;
    }>(
      `SELECT registry_revision::text, kind, lifecycle FROM source_catalog
       WHERE id=$1 FOR SHARE`,
      [key.sourceId],
    );
    if (
      source.rows[0]?.registry_revision !== key.sourceRevision ||
      source.rows[0]?.kind !== "treatment" ||
      source.rows[0]?.lifecycle !== "configured"
    ) {
      throw new Error("Viewport source revision is not configured");
    }
  }
}
