// Feature IDs: SOURCES.DOCUMENT_HISTORY, NOTICES.EXTRACTION
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

/** Commit page progress together with the evidence transaction; incomplete scans remain incomplete. */
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
