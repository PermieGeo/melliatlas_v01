// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  advanceSaturnViewportProgress,
  countViewportPlanIds,
  startSaturnViewportProgress,
} from "../src/modules/sources/providers/saturn/saturnViewportProgress.js";
import { validateSaturnViewportQuery } from "../src/modules/sources/providers/saturn/saturnViewportQuery.js";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)),
      "utf8",
    ),
  ) as unknown;
}
const observedRequest = validateSaturnViewportQuery(
  fixture("saturn-yartsevo-viewport-request"),
);
const observedFirst = fixture("saturn-yartsevo-viewport-response") as Record<
  string,
  unknown
>;

/** Synthetic continuation, not a capture or a claim about actual Saturn pages. */
function syntheticPage(
  number: number,
  features: number[],
  totalElements = 22,
): Record<string, unknown> {
  const totalPages = Math.ceil(totalElements / 10);
  return {
    content: features.map((id) => ({
      id,
      planId: id + 10000,
      name: `FICTIONAL plan ${id}`,
      centerX: 32.9,
      centerY: 55.0,
    })),
    pageable: { pageNumber: number, pageSize: 10 },
    totalPages,
    totalElements,
    last: totalPages === 0 || number === totalPages - 1,
    first: number === 0,
    numberOfElements: features.length,
    number,
    size: 10,
    empty: features.length === 0,
  };
}

describe("Saturn viewport page reconciliation (offline only)", () => {
  it("starts with no coverage claim and validates the observed request", () => {
    const start = startSaturnViewportProgress(observedRequest);
    expect(start).toMatchObject({
      status: "partial",
      nextPage: 0,
      pagesFetched: 0,
      totalElements: null,
    });
    expect(() =>
      startSaturnViewportProgress({ ...observedRequest, pageNumber: 1 }),
    ).toThrow("page zero");
    expect(() =>
      startSaturnViewportProgress({
        ...observedRequest,
        filter: { ...observedRequest.filter, district: "99999999999" },
      }),
    ).toThrow();
    expect(() =>
      startSaturnViewportProgress({
        ...observedRequest,
        filter: {
          ...observedRequest.filter,
          startDateUpdateMap: "2026-02-30T00:00:00.000Z",
        },
      }),
    ).toThrow();
  });

  it("reconciles all three pages without claiming district or treatment coverage", () => {
    const first = advanceSaturnViewportProgress(
      startSaturnViewportProgress(observedRequest),
      observedFirst,
    );
    expect(first).toMatchObject({
      status: "partial",
      nextPage: 1,
      pagesFetched: 1,
      totalPages: 3,
      totalElements: 22,
    });
    expect(first.entries).toHaveLength(10);
    expect(countViewportPlanIds(first)).toBe(3);
    const second = advanceSaturnViewportProgress(
      first,
      syntheticPage(
        1,
        Array.from({ length: 10 }, (_, i) => 9000000 + i),
      ),
    );
    const final = advanceSaturnViewportProgress(
      second,
      syntheticPage(2, [9000010, 9000011]),
    );
    expect(final).toMatchObject({
      status: "viewport_index_complete",
      nextPage: null,
      pagesFetched: 3,
      totalElements: 22,
    });
    expect(final.entries).toHaveLength(22);
    expect(new Set(final.entries.map((item) => item.featureId)).size).toBe(22);
    expect(countViewportPlanIds(final)).toBe(15);
    expect(() =>
      advanceSaturnViewportProgress(final, syntheticPage(2, [])),
    ).toThrow("already terminal");
  });

  it("rejects a skipped page and preserves the prior state", () => {
    const first = advanceSaturnViewportProgress(
      startSaturnViewportProgress(observedRequest),
      observedFirst,
    );
    expect(() =>
      advanceSaturnViewportProgress(first, syntheticPage(2, [1, 2])),
    ).toThrow();
    expect(first.nextPage).toBe(1);
    expect(first.entries).toHaveLength(10);
  });

  it("fails closed if provider totals change between pages", () => {
    const first = advanceSaturnViewportProgress(
      startSaturnViewportProgress(observedRequest),
      observedFirst,
    );
    expect(() =>
      advanceSaturnViewportProgress(
        first,
        syntheticPage(
          1,
          Array.from({ length: 10 }, (_, i) => 9000000 + i),
          23,
        ),
      ),
    ).toThrow("totals changed");
  });

  it("rejects duplicate feature IDs across pages, even across different plans", () => {
    const first = advanceSaturnViewportProgress(
      startSaturnViewportProgress(observedRequest),
      observedFirst,
    );
    const existingId = Number(first.entries[0]?.featureId);
    const duplicated = syntheticPage(1, [
      existingId,
      ...Array.from({ length: 9 }, (_, i) => 9000000 + i),
    ]);
    expect(() => advanceSaturnViewportProgress(first, duplicated)).toThrow(
      "repeated across pages",
    );
  });

  it("rejects a malformed terminal page rather than advancing coverage", () => {
    const first = advanceSaturnViewportProgress(
      startSaturnViewportProgress(observedRequest),
      observedFirst,
    );
    const second = advanceSaturnViewportProgress(
      first,
      syntheticPage(
        1,
        Array.from({ length: 10 }, (_, i) => 9000000 + i),
      ),
    );
    expect(() =>
      advanceSaturnViewportProgress(second, syntheticPage(2, [9000010])),
    ).toThrow();
    expect(second.status).toBe("partial");
  });

  it("accepts an empty first and last page only at page zero", () => {
    const empty = syntheticPage(0, [], 0);
    const complete = advanceSaturnViewportProgress(
      startSaturnViewportProgress(observedRequest),
      empty,
    );
    expect(complete).toMatchObject({
      status: "viewport_index_complete",
      totalElements: 0,
      pagesFetched: 1,
    });
    expect(() =>
      advanceSaturnViewportProgress(
        startSaturnViewportProgress(observedRequest),
        syntheticPage(1, [], 0),
      ),
    ).toThrow();
  });

  it("rejects unsupported filter keys before processing any page", () => {
    expect(() =>
      startSaturnViewportProgress({
        ...observedRequest,
        filter: {
          ...observedRequest.filter,
          arbitrarySourceFilter: true,
        },
      } as Parameters<typeof startSaturnViewportProgress>[0]),
    ).toThrow();
  });
});
