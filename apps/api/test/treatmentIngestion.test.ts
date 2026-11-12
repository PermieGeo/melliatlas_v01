// Feature IDs: NOTICES.EXTRACTION, NOTICES.MAP_OVERLAY, NOTICES.SPATIAL_PRECISION
import { describe, expect, it } from "vitest";
import {
  nextTreatmentPageNumber,
  safePlanGeometry,
} from "../src/modules/sources/treatmentIngestion.js";
import { parseBeekeeperPlanPage } from "../src/modules/sources/beekeeperPlanPage.js";

const ring = [
  [32, 54],
  [33, 54],
  [33, 55],
  [32, 54],
] as [number, number][];

describe("provider map geometry evidence", () => {
  it("keeps a source polygon without converting longitude and latitude", () => {
    expect(safePlanGeometry({ type: "Polygon", coordinates: [ring] })).toEqual({
      type: "Polygon",
      coordinates: [ring],
    });
  });
  it("rejects an unclosed polygon rather than guessing a field boundary", () => {
    expect(
      safePlanGeometry({
        type: "Polygon",
        coordinates: [ring.slice(0, 3).concat([[32, 56] as [number, number]])],
      }),
    ).toBeNull();
  });
  it("does not fabricate geometry for an absent polygon", () => {
    expect(safePlanGeometry(null)).toBeNull();
  });
});

describe("bounded provider page advancement", () => {
  const parsed = (page: Record<string, unknown>, count = 1) =>
    parseBeekeeperPlanPage({
      content: Array.from({ length: count }, (_, index) => ({
        beeAcreage: { id: 44 + index },
      })),
      ...page,
    });

  it("continues or completes according to consistent Spring pagination", () => {
    expect(
      nextTreatmentPageNumber(
        parsed(
          {
            number: 0,
            size: 2,
            numberOfElements: 2,
            totalElements: 3,
            totalPages: 2,
            last: false,
          },
          2,
        ),
        0,
        2,
      ),
    ).toBe(1);
    expect(
      nextTreatmentPageNumber(
        parsed({
          number: 1,
          size: 2,
          numberOfElements: 1,
          totalElements: 3,
          totalPages: 2,
          last: true,
        }),
        1,
        2,
      ),
    ).toBe(0);
  });

  it("rejects replayed pages, mismatched sizes and contradictory completion metadata", () => {
    for (const metadata of [
      { number: 0, size: 2, totalElements: 3, totalPages: 2, last: true },
      { number: 1, size: 4, totalElements: 3, totalPages: 2, last: true },
      { number: 1, size: 2, totalElements: 3, totalPages: 3, last: true },
      { number: 1, size: 2, totalElements: 3, totalPages: 2, last: false },
      {
        number: 1,
        size: 2,
        totalElements: 3,
        totalPages: 2,
        last: true,
        numberOfElements: 2,
      },
    ]) {
      expect(() => nextTreatmentPageNumber(parsed(metadata), 1, 2)).toThrow(
        "Provider page metadata does not match the requested page",
      );
    }
  });

  it("enforces totalPages even when totalElements is absent", () => {
    expect(
      nextTreatmentPageNumber(
        parsed({ number: 0, size: 2, totalPages: 2 }, 2),
        0,
        2,
      ),
    ).toBe(1);
    expect(
      nextTreatmentPageNumber(
        parsed({ number: 1, size: 2, totalPages: 2 }, 1),
        1,
        2,
      ),
    ).toBe(0);
    expect(
      nextTreatmentPageNumber(
        parseBeekeeperPlanPage({ content: [], totalPages: 0, last: true }),
        0,
        2,
      ),
    ).toBe(0);

    for (const [metadata, requestedPage, count] of [
      [{ number: 1, size: 2, totalPages: 1, last: true }, 1, 2],
      [{ number: 0, size: 2, totalPages: 0, last: true }, 0, 1],
      [{ number: 0, size: 2, totalPages: 2, last: true }, 0, 2],
      [{ number: 1, size: 2, totalPages: 2, last: false }, 1, 1],
      [{ number: 0, size: 2, totalPages: 2 }, 0, 1],
      [{ number: 0, size: 2, totalPages: 1 }, 0, 0],
    ] as const) {
      expect(() =>
        nextTreatmentPageNumber(parsed(metadata, count), requestedPage, 2),
      ).toThrow("Provider page metadata does not match the requested page");
    }
  });

  it("rejects short nonterminal pages that would silently skip source records", () => {
    expect(() =>
      nextTreatmentPageNumber(
        parsed({
          number: 0,
          size: 2,
          totalElements: 3,
          totalPages: 2,
          last: false,
        }),
        0,
        2,
      ),
    ).toThrow("Provider page metadata does not match the requested page");
    expect(() =>
      nextTreatmentPageNumber(parsed({ last: false }), 0, 2),
    ).toThrow("Provider page metadata does not match the requested page");
  });

  it("refuses empty mid-range pages and out-of-range cursors", () => {
    expect(() =>
      nextTreatmentPageNumber(
        parseBeekeeperPlanPage({
          content: [],
          totalElements: 3,
          number: 0,
          size: 2,
        }),
        0,
        2,
      ),
    ).toThrow("Provider page metadata does not match the requested page");
    expect(() =>
      nextTreatmentPageNumber(
        parseBeekeeperPlanPage({
          content: [],
          totalElements: 1,
          number: 1,
          size: 2,
        }),
        1,
        2,
      ),
    ).toThrow("Provider page metadata does not match the requested page");
  });

  it("uses provider last when totals are unknown, with a short-page fallback", () => {
    expect(nextTreatmentPageNumber(parsed({ last: false }, 2), 0, 2)).toBe(1);
    expect(nextTreatmentPageNumber(parsed({ last: true }), 0, 2)).toBe(0);
    expect(nextTreatmentPageNumber(parsed({}), 0, 2)).toBe(0);
  });
});
