// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it } from "vitest";
import {
  DISTRICT_TTL_HOURS,
  advanceDistrictCache,
  districtCoverage,
  districtFilterHash,
  type DistrictCacheEntry,
} from "../src/modules/sources/districtCacheState.js";

const start = new Date("2026-11-02T10:00:00.000Z");
const entry: DistrictCacheEntry = {
  sourceId: "treatment-feed",
  revision: "2",
  districtId: 123,
  filterHash: districtFilterHash(55, 123, {
    sortColumn: "datePublishing",
    pageSize: 40,
  }),
  state: "running",
  nextPage: 0,
  pagesFetched: 0,
  recordsReceived: 0,
  recordsStored: 0,
  totalElements: null,
  completedAt: null,
  expiresAt: null,
  lastErrorCode: null,
};

describe("district coverage and freshness", () => {
  it("does not infer coverage from an absent, running, or paused scan", () => {
    expect(districtCoverage(null, start)).toBe("unknown");
    expect(districtCoverage(entry, start)).toBe("partial");
    expect(districtCoverage({ ...entry, state: "paused" }, start)).toBe(
      "partial",
    );
  });
  it("marks only a complete final page as fresh for precisely 24 hours", () => {
    const partial = advanceDistrictCache(entry, 1, 40, 35, start);
    expect(districtCoverage(partial, start)).toBe("partial");
    const completed = advanceDistrictCache(partial, 0, 4, 3, start);
    expect(completed).toMatchObject({
      state: "completed",
      pagesFetched: 2,
      recordsReceived: 44,
      recordsStored: 38,
      nextPage: 0,
    });
    expect(
      districtCoverage(completed, new Date(start.getTime() + 23 * 3_600_000)),
    ).toBe("fresh");
    expect(
      districtCoverage(
        completed,
        new Date(start.getTime() + DISTRICT_TTL_HOURS * 3_600_000),
      ),
    ).toBe("stale");
  });
  it("retains prior completion as stale while a replacement listing is incomplete or fails", () => {
    const completed = advanceDistrictCache(entry, 0, 0, 0, start);
    const refreshing = { ...completed, state: "running" as const };
    const partial = advanceDistrictCache(
      refreshing,
      1,
      20,
      18,
      new Date(start.getTime() + 60_000),
    );
    expect(partial.completedAt).toBe(completed.completedAt);
    expect(partial.expiresAt).toBe(completed.expiresAt);
    expect(districtCoverage(partial, start)).toBe("stale");
    expect(districtCoverage({ ...partial, state: "failed" }, start)).toBe(
      "stale",
    );
  });
  it("allows complete zero-result listings to be fresh", () => {
    const completed = advanceDistrictCache(entry, 0, 0, 0, start);
    expect(districtCoverage(completed, start)).toBe("fresh");
  });
  it("pauses at the page cap and rejects invalid progress", () => {
    expect(
      advanceDistrictCache({ ...entry, nextPage: 1999 }, 2000, 40, 40, start),
    ).toMatchObject({ state: "paused", lastErrorCode: "DISTRICT_PAGE_LIMIT" });
    expect(() => advanceDistrictCache(entry, 2, 0, 1, start)).toThrow(
      "Invalid district page transition",
    );
  });
  it("shares a cache identity for identical district filters but not different districts", () => {
    expect(
      districtFilterHash(55, 123, {
        pageNumber: 0,
        pageSize: 40,
        sortColumn: "x",
      }),
    ).toBe(
      districtFilterHash(55, 123, {
        sortColumn: "x",
        pageNumber: 5,
        pageSize: 80,
      }),
    );
    expect(districtFilterHash(55, 123, {})).not.toBe(
      districtFilterHash(55, 124, {}),
    );
    expect(() => districtFilterHash(-1, 123, {})).toThrow();
  });
});
