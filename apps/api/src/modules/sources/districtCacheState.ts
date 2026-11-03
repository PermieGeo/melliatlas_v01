// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";

export const DISTRICT_TTL_HOURS = 24;
export const MAX_DISTRICT_PAGES = 2000;
export const DISTRICT_LEASE_MINUTES = 5;

export type DistrictCacheKey = {
  sourceId: string;
  revision: string;
  districtId: number;
  filterHash: string;
};

export type DistrictCacheState = "running" | "paused" | "completed" | "failed";
export type DistrictCacheCoverage = "fresh" | "stale" | "partial" | "unknown";

export type DistrictCacheEntry = DistrictCacheKey & {
  state: DistrictCacheState;
  nextPage: number;
  pagesFetched: number;
  recordsReceived: number;
  recordsStored: number;
  totalElements: number | null;
  completedAt: string | null;
  expiresAt: string | null;
  lastErrorCode: string | null;
};

/**
 * Build a stable identity for a real, verified upstream filter set.
 *
 * @param regionId - Provider region ID, not the ISO region code.
 * @param districtId - Provider district ID validated against the selected region.
 * @param requestParameters - Provider filter parameters, excluding pagination.
 * @returns SHA-256 digest of the canonical filter identity.
 */
export function districtFilterHash(
  regionId: number,
  districtId: number,
  requestParameters: Readonly<Record<string, unknown>>,
): string {
  if (
    !Number.isSafeInteger(regionId) ||
    regionId < 1 ||
    !Number.isSafeInteger(districtId) ||
    districtId < 1
  ) {
    throw new Error("Invalid provider territory identifiers");
  }
  const parameters = Object.entries(requestParameters)
    .filter(([key]) => !["pageNumber", "pageSize"].includes(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256")
    .update(JSON.stringify({ regionId, districtId, parameters }))
    .digest("hex");
}

/**
 * Evaluate completed coverage without claiming freshness from a partial scan.
 *
 * @param entry - Stored cache entry, if one exists for the exact filter identity.
 * @param now - Current UTC instant.
 * @returns Fresh only for an unexpired fully completed listing.
 */
export function districtCoverage(
  entry: DistrictCacheEntry | null,
  now: Date,
): DistrictCacheCoverage {
  if (!entry) return "unknown";
  if (entry.state !== "completed") {
    // Earlier successful coverage remains historical, never newly fresh.
    return entry.completedAt && entry.expiresAt ? "stale" : "partial";
  }
  if (!entry.completedAt || !entry.expiresAt || entry.nextPage !== 0)
    return "partial";
  const expires = Date.parse(entry.expiresAt);
  return Number.isFinite(expires) && now.getTime() < expires
    ? "fresh"
    : "stale";
}

/**
 * Apply one imported page's progress after its evidence transaction succeeds.
 *
 * @param current - Previous committed state of the selected district/filter.
 * @param nextPage - Next page, with zero indicating the provider's terminal page.
 * @param received - Number of records returned on this page, including zero.
 * @param stored - Number of new persisted observations.
 * @param now - Commit instant used for the complete-coverage TTL.
 * @returns Next durable state; 24-hour freshness only on a terminal page.
 */
export function advanceDistrictCache(
  current: DistrictCacheEntry,
  nextPage: number,
  received: number,
  stored: number,
  now: Date,
): DistrictCacheEntry {
  if (
    current.state !== "running" ||
    !Number.isSafeInteger(nextPage) ||
    nextPage < 0 ||
    !Number.isSafeInteger(received) ||
    received < 0 ||
    !Number.isSafeInteger(stored) ||
    stored < 0 ||
    stored > received ||
    (nextPage !== 0 && nextPage !== current.nextPage + 1)
  ) {
    throw new Error("Invalid district page transition");
  }
  const completed = nextPage === 0;
  const capped = nextPage >= MAX_DISTRICT_PAGES;
  return {
    ...current,
    state: completed ? "completed" : capped ? "paused" : "running",
    nextPage,
    pagesFetched: current.pagesFetched + 1,
    recordsReceived: current.recordsReceived + received,
    recordsStored: current.recordsStored + stored,
    completedAt: completed ? now.toISOString() : current.completedAt,
    expiresAt: completed
      ? new Date(now.getTime() + DISTRICT_TTL_HOURS * 3_600_000).toISOString()
      : current.expiresAt,
    lastErrorCode: capped ? "DISTRICT_PAGE_LIMIT" : null,
  };
}
