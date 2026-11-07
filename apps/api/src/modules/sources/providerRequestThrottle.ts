// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { Pool } from "pg";

// Minimum spacing for explicit, authorized pilot requests; provider limits take precedence.
export const SOURCE_REQUEST_GAP_MS = 20_000;

export type ProviderRequestGate = {
  reserve(sourceId: string): Promise<boolean>;
};

/**
 * Reserve one external request start per source across API processes.
 * A failed request still consumes its slot; the caller never waits in a DB lock.
 */
export class ProviderRequestThrottle implements ProviderRequestGate {
  constructor(private readonly db: Pool) {}

  /**
   * Reserve the next permitted fetch start using the database wall clock.
   *
   * @param sourceId - Existing source catalog identity.
   * @returns False if another caller reserved a still-active throttle window.
   */
  async reserve(sourceId: string): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO source_request_throttle (source_id, next_allowed_at)
       VALUES ($1, clock_timestamp() + ($2::integer * interval '1 millisecond'))
       ON CONFLICT (source_id) DO UPDATE
         SET next_allowed_at = clock_timestamp() + ($2::integer * interval '1 millisecond'),
             updated_at = clock_timestamp()
       WHERE source_request_throttle.next_allowed_at <= clock_timestamp()
       RETURNING source_id`,
      [sourceId, SOURCE_REQUEST_GAP_MS],
    );
    return result.rowCount === 1;
  }
}
