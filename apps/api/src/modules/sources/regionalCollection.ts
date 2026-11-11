// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { Pool, PoolClient } from "pg";
import { providerRequestSettingsSchema } from "@melliatlas/contracts";
import { ApiFailure } from "../../lib/errors.js";
import { TreatmentIngestionService } from "./treatmentIngestion.js";
import {
  readSourceCursor,
  type RegionalScan,
  type SourceCursor,
} from "./regionalScanState.js";

const SOURCE_ID = "treatment-feed";
const MIN_REQUEST_GAP_MS = 65_000;
const WORKER_POLL_MS = 15_000;

type SourceRow = {
  lifecycle: string;
  registry_revision: string;
  api_request_config: unknown;
  source_cursor: unknown;
};

export type RegionCollectionStatus = {
  regionCode: number | null;
  nextPage: number;
  scan: RegionalScan | null;
};

function regionCode(row: SourceRow): number {
  const config = row.api_request_config as { request?: unknown } | null;
  const request = providerRequestSettingsSchema.safeParse(config?.request);
  if (!request.success) {
    throw new ApiFailure(
      409,
      "INVALID_PROVIDER_CONFIG",
      "Configure a valid provider region",
    );
  }
  return request.data.regionCode;
}

export class RegionalCollectionService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private processing = false;
  private stopped = false;

  constructor(
    private readonly pool: Pool,
    private readonly ingestion: TreatmentIngestionService,
    private readonly scheduledUtcHour?: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async status(): Promise<RegionCollectionStatus> {
    const result = await this.pool.query<SourceRow>(
      "SELECT lifecycle, registry_revision, api_request_config, source_cursor FROM source_catalog WHERE id=$1",
      [SOURCE_ID],
    );
    if (!result.rows[0])
      throw new ApiFailure(
        404,
        "PROVIDER_NOT_CONFIGURED",
        "Source not configured",
      );
    const cursor = readSourceCursor(result.rows[0].source_cursor);
    const region = providerRequestSettingsSchema.safeParse(
      (result.rows[0].api_request_config as { request?: unknown } | null)
        ?.request,
    );
    return {
      regionCode: region.success ? region.data.regionCode : null,
      nextPage: cursor.pageNumber,
      scan: cursor.scan ?? null,
    };
  }

  private async locked<T>(
    work: (client: PoolClient, row: SourceRow) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<SourceRow>(
        "SELECT lifecycle, registry_revision, api_request_config, source_cursor FROM source_catalog WHERE id=$1 FOR UPDATE",
        [SOURCE_ID],
      );
      if (!result.rows[0])
        throw new ApiFailure(
          404,
          "PROVIDER_NOT_CONFIGURED",
          "Source not configured",
        );
      const value = await work(client, result.rows[0]);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start or resume the persisted scan for the currently configured provider region.
   *
   * @param scheduledOn - UTC calendar date for scheduler deduplication, or null for a manual start.
   * @returns The durable scan status after the transaction commits.
   * @throws ApiFailure if the source is unconfigured, a scan is already active, or the page limit was reached.
   */
  async start(
    scheduledOn: string | null = null,
  ): Promise<RegionCollectionStatus> {
    const now = this.now().toISOString();
    await this.locked(async (client, row) => {
      if (row.lifecycle !== "configured")
        throw new ApiFailure(
          409,
          "SOURCE_NOT_CONFIGURED",
          "Source not configured",
        );
      const region = regionCode(row);
      const cursor = readSourceCursor(row.source_cursor);
      if (
        cursor.scan?.errorCode === "REGION_PAGE_LIMIT" &&
        cursor.scan.revision === row.registry_revision &&
        cursor.scan.regionCode === region
      ) {
        throw new ApiFailure(
          409,
          "REGION_PAGE_LIMIT",
          "Region scan page limit reached; review the provider configuration",
        );
      }
      if (cursor.scan?.state === "running")
        throw new ApiFailure(
          409,
          "REGION_SCAN_ACTIVE",
          "Regional collection already running",
        );
      const resume =
        cursor.scan?.state === "paused" &&
        cursor.scan.revision === row.registry_revision &&
        cursor.scan.regionCode === region;
      const scan: RegionalScan = resume
        ? {
            ...cursor.scan!,
            state: "running",
            errorCode: null,
            consecutiveErrors: 0,
          }
        : {
            state: "running",
            revision: row.registry_revision,
            regionCode: region,
            scheduledOn: scheduledOn ?? now.slice(0, 10),
            startedAt: now,
            completedAt: null,
            nextAllowedAt: now,
            pagesFetched: 0,
            recordsReceived: 0,
            recordsStored: 0,
            totalElements: null,
            errorCode: null,
            consecutiveErrors: 0,
          };
      await client.query(
        "UPDATE source_catalog SET source_cursor=$2::jsonb WHERE id=$1",
        [
          SOURCE_ID,
          JSON.stringify({ pageNumber: resume ? cursor.pageNumber : 0, scan }),
        ],
      );
    });
    return this.status();
  }

  async pause(): Promise<RegionCollectionStatus> {
    await this.locked(async (client, row) => {
      const cursor = readSourceCursor(row.source_cursor);
      if (cursor.scan?.state !== "running")
        throw new ApiFailure(
          409,
          "REGION_SCAN_INACTIVE",
          "No running regional collection",
        );
      await client.query(
        "UPDATE source_catalog SET source_cursor=$2::jsonb WHERE id=$1",
        [
          SOURCE_ID,
          JSON.stringify({
            ...cursor,
            scan: { ...cursor.scan, state: "paused" },
          }),
        ],
      );
    });
    return this.status();
  }

  private async maybeStartScheduled(): Promise<void> {
    if (this.scheduledUtcHour === undefined) return;
    const now = this.now();
    if (now.getUTCHours() < this.scheduledUtcHour) return;
    const today = now.toISOString().slice(0, 10);
    const status = await this.status();
    if (status.scan?.state === "running" || status.scan?.scheduledOn === today)
      return;
    if (status.scan?.state === "paused") return;
    try {
      await this.start(today);
    } catch (error) {
      if (!(
        error instanceof ApiFailure &&
        ["REGION_SCAN_ACTIVE", "SOURCE_NOT_CONFIGURED"].includes(error.code)
      ))
        throw error;
    }
  }

  /**
   * Reserve one provider fetch slot with a database-atomic transition.
   *
   * @param now - The scan worker's current time, also used for the rate-limit deadline.
   * @returns The claimed cursor, or null if no scan is ready.
   */
  private async claimFetchSlot(now: Date): Promise<SourceCursor | null> {
    const nextAllowedAt = new Date(
      now.getTime() + MIN_REQUEST_GAP_MS,
    ).toISOString();
    const claim = await this.pool.query<{ source_cursor: unknown }>(
      `UPDATE source_catalog SET source_cursor=jsonb_set(source_cursor,'{scan,nextAllowedAt}',to_jsonb($2::text))
       WHERE id=$1 AND source_cursor->'scan'->>'state'='running'
         AND (source_cursor->'scan'->>'nextAllowedAt')::timestamptz <= $3::timestamptz
       RETURNING source_cursor`,
      [SOURCE_ID, nextAllowedAt, now.toISOString()],
    );
    return claim.rows[0] ? readSourceCursor(claim.rows[0].source_cursor) : null;
  }

  /**
   * Persist a bounded retry delay without altering scan pagination or overriding a paused scan.
   *
   * @param cursor - The cursor from the previously reserved fetch slot.
   * @param now - Time when the slot was claimed.
   * @param error - The failed ingestion's structured or unknown error.
   */
  private async recordFetchFailure(
    cursor: SourceCursor,
    now: Date,
    error: unknown,
  ): Promise<void> {
    const code =
      error instanceof ApiFailure ? error.code : "REGION_FETCH_FAILED";
    const errors = (cursor.scan?.consecutiveErrors ?? 0) + 1;
    const nextAttempt = new Date(
      now.getTime() + MIN_REQUEST_GAP_MS * Math.min(errors + 1, 5),
    );
    await this.pool.query(
      `UPDATE source_catalog SET source_cursor=jsonb_set(source_cursor,'{scan}',
       (source_cursor->'scan') || jsonb_build_object('consecutiveErrors',$2::integer,
         'errorCode',$3::text,'nextAllowedAt',$4::text,
         'state',CASE WHEN $2 >= 3 THEN 'paused' ELSE 'running' END))
       WHERE id=$1 AND source_cursor->'scan'->>'state'='running'
         AND source_cursor->'scan'->>'startedAt'=$5`,
      [
        SOURCE_ID,
        errors,
        code,
        nextAttempt.toISOString(),
        cursor.scan?.startedAt,
      ],
    );
  }

  /**
   * Process at most one rate-limited page; a public map refresh never calls this method.
   *
   * @throws The underlying database error when claiming or recording a page fails.
   */
  async tick(): Promise<void> {
    if (this.processing || this.stopped) return;
    this.processing = true;
    try {
      await this.maybeStartScheduled();
      const now = this.now();
      const cursor = await this.claimFetchSlot(now);
      if (!cursor) return;
      try {
        await this.ingestion.syncOnePage("scan");
      } catch (error: unknown) {
        await this.recordFetchFailure(cursor, now, error);
      }
    } finally {
      this.processing = false;
    }
  }

  run(): void {
    if (this.timer) return;
    this.stopped = false;
    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) => {
        console.error(
          "Regional collection worker failed",
          error instanceof Error ? error.name : "UNKNOWN_ERROR",
        );
      });
    }, WORKER_POLL_MS);
    this.timer.unref();
    void this.tick().catch((error: unknown) => {
      console.error(
        "Regional collection worker failed",
        error instanceof Error ? error.name : "UNKNOWN_ERROR",
      );
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
