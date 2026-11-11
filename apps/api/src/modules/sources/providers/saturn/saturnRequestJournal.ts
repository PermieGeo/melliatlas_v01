// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { Pool } from "pg";
import {
  saturnRequestLogResponseSchema,
  type SaturnRequestLogResponse,
} from "@melliatlas/contracts";
import {
  SATURN_REQUEST_LOG_LIMIT,
  SATURN_SOURCE_ID,
  SaturnRequestAction,
  SaturnRequestInitiator,
  SaturnRequestOutcome,
} from "./sourceProfile.js";

export type RequestOutcome =
  | `${SaturnRequestOutcome.Succeeded}`
  | `${SaturnRequestOutcome.Failed}`
  | `${SaturnRequestOutcome.Throttled}`
  | `${SaturnRequestOutcome.CacheHit}`;
export type RequestAttempt = {
  action: `${SaturnRequestAction}`;
  initiator: `${SaturnRequestInitiator}`;
  districtId?: number;
  requestHash?: string;
  pageNumber?: number;
};

/** Postgres-backed activity records for explicitly requested upstream operations. */
export class SaturnRequestJournal {
  constructor(private readonly db: Pick<Pool, "query">) {}

  /** Start a durable attempt before throttling or I/O, including denied attempts. */
  async start(attempt: RequestAttempt): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO source_saturn_request_log
       (source_id, action, initiator, district_provider_id, request_hash, page_number, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text`,
      [
        SATURN_SOURCE_ID,
        attempt.action,
        attempt.initiator,
        attempt.districtId ?? null,
        attempt.requestHash ?? null,
        attempt.pageNumber ?? null,
        SaturnRequestOutcome.Started,
      ],
    );
    if (!result.rows[0])
      throw new Error("Failed to write source request audit entry");
    return result.rows[0].id;
  }

  /** Only an unfinished attempt can transition to a terminal outcome. */
  async finish(
    id: string,
    outcome: RequestOutcome,
    receivedCount = 0,
    errorCode?: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE source_saturn_request_log SET status=$2, received_count=$3,
         error_code=$4, finished_at=now()
       WHERE id=$1::bigint AND status=$5`,
      [
        id,
        outcome,
        receivedCount,
        errorCode ?? null,
        SaturnRequestOutcome.Started,
      ],
    );
  }

  /** Bounded read-only log; records failed attempts even when no page was saved. */
  async list(): Promise<SaturnRequestLogResponse> {
    const result = await this.db.query<{
      id: string;
      action: RequestAttempt["action"];
      initiator: RequestAttempt["initiator"];
      district_provider_id: number | null;
      request_hash: string | null;
      page_number: number | null;
      status: RequestOutcome | `${SaturnRequestOutcome.Started}`;
      received_count: number | null;
      error_code: string | null;
      started_at: Date;
      finished_at: Date | null;
    }>(
      `SELECT id::text, action, initiator, district_provider_id, request_hash,
              page_number, status, received_count, error_code, started_at, finished_at
       FROM source_saturn_request_log WHERE source_id=$1
       ORDER BY started_at DESC, id DESC LIMIT $2`,
      [SATURN_SOURCE_ID, SATURN_REQUEST_LOG_LIMIT],
    );
    return saturnRequestLogResponseSchema.parse({
      entries: result.rows.map((row) => ({
        id: row.id,
        action: row.action,
        initiator: row.initiator,
        districtId: row.district_provider_id,
        requestHash: row.request_hash?.trim() ?? null,
        pageNumber: row.page_number,
        status: row.status,
        receivedCount: row.received_count,
        errorCode: row.error_code,
        startedAt: row.started_at.toISOString(),
        finishedAt: row.finished_at?.toISOString() ?? null,
      })),
    });
  }
}
