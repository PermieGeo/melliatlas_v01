// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";

export const regionalScanSchema = z
  .object({
    state: z.enum(["running", "paused", "completed"]),
    revision: z.string(),
    regionCode: z.number().int().positive(),
    scheduledOn: z.string().nullable(),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    nextAllowedAt: z.string().datetime(),
    pagesFetched: z.number().int().nonnegative(),
    recordsReceived: z.number().int().nonnegative(),
    recordsStored: z.number().int().nonnegative(),
    totalElements: z.number().int().nonnegative().nullable(),
    errorCode: z.string().nullable(),
    consecutiveErrors: z.number().int().nonnegative(),
  })
  .strict();

export type RegionalScan = z.infer<typeof regionalScanSchema>;
export type SourceCursor = { pageNumber: number; scan?: RegionalScan };

/**
 * Read a persisted cursor without trusting unvalidated database JSON.
 *
 * @param value - Stored cursor document of unknown structure.
 * @returns A safe page number and, when valid, the regional scan metadata.
 */
export function readSourceCursor(value: unknown): SourceCursor {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { pageNumber: 0 };
  }
  const data = value as Record<string, unknown>;
  const pageNumber =
    Number.isInteger(data.pageNumber) &&
    Number(data.pageNumber) >= 0 &&
    Number(data.pageNumber) <= 100000
      ? Number(data.pageNumber)
      : 0;
  const scan = regionalScanSchema.safeParse(data.scan);
  return { pageNumber, ...(scan.success ? { scan: scan.data } : {}) };
}

/**
 * Advance pagination and scan counters in the same transaction as imported evidence.
 *
 * @param cursor - The previously persisted cursor.
 * @param nextPage - Next page number, or zero after the terminal page.
 * @param received - Number of records received in this page.
 * @param stored - Number of records successfully stored in this page.
 * @param totalElements - Upstream estimate when available.
 * @param now - Completion timestamp for a terminal page.
 * @returns The new cursor; a page limit pauses rather than completes the scan.
 */
export function advanceSourceCursor(
  cursor: SourceCursor,
  nextPage: number,
  received: number,
  stored: number,
  totalElements: number | null,
  now: Date,
): SourceCursor {
  const scan = cursor.scan;
  if (!scan || scan.state !== "running")
    return { ...cursor, pageNumber: nextPage };
  const capped = nextPage >= 2000;
  const completed = nextPage === 0;
  return {
    pageNumber: nextPage,
    scan: {
      ...scan,
      state: completed ? "completed" : capped ? "paused" : "running",
      completedAt: completed ? now.toISOString() : null,
      pagesFetched: scan.pagesFetched + 1,
      recordsReceived: scan.recordsReceived + received,
      recordsStored: scan.recordsStored + stored,
      totalElements: totalElements ?? scan.totalElements,
      errorCode: capped ? "REGION_PAGE_LIMIT" : null,
      consecutiveErrors: 0,
    },
  };
}
