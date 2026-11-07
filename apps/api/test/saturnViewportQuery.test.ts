// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildSaturnViewportQuery,
  parseSaturnViewportPage,
} from "../src/modules/sources/saturnViewportQuery.js";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)),
      "utf8",
    ),
  ) as unknown;
const observedRequest = fixture("saturn-yartsevo-viewport-request") as Record<
  string,
  unknown
>;
const observedResponse = fixture("saturn-yartsevo-viewport-response") as Record<
  string,
  unknown
>;
const districts = [
  { id: 1477, name: "Yartsevo", longitude: 32.68, latitude: 55.06 },
  { id: 2670, name: "Smolensk", longitude: 32.05, latitude: 54.79 },
];
const selection = {
  districts,
  districtId: 1477,
  bbox: {
    west: 32.409804730540266,
    south: 54.92780435298192,
    east: 33.02984562409493,
    north: 55.210325361370735,
  },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
  pageNumber: 0,
};
const request = buildSaturnViewportQuery(selection);

describe("observed Saturn district/time viewport query (offline)", () => {
  it("reproduces the captured district, viewport, date and first-page payload exactly", () => {
    expect(request).toEqual(observedRequest);
    expect(request.filter.subject).toBe("55");
    expect(request.filter.district).toBe("1477");
    expect(request.filter.startDateUpdateMap).toBe("2026-08-01T00:00:00.000Z");
    expect(request.filter.endDateUpdateMap).toBe("2026-11-30T00:00:00.000Z");
  });

  it("rejects district IDs outside the selected region directory", () => {
    expect(() =>
      buildSaturnViewportQuery({ ...selection, districtId: 9999 }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({
        ...selection,
        districtId: 2670,
        districts: [districts[0]],
      }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({
        ...selection,
        districts: [districts[0], districts[0]],
      }),
    ).toThrow();
  });

  it("refuses invalid bounding boxes and oversized page numbers", () => {
    expect(() =>
      buildSaturnViewportQuery({
        ...selection,
        bbox: { ...selection.bbox, east: 30 },
      }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({
        ...selection,
        bbox: { ...selection.bbox, north: 54 },
      }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({
        ...selection,
        bbox: { ...selection.bbox, west: -181 },
      }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({ ...selection, pageNumber: 2000 }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({ ...selection, pageNumber: -1 }),
    ).toThrow();
  });

  it("rejects nonsensical calendar dates and reversed UpdateMap windows", () => {
    expect(() =>
      buildSaturnViewportQuery({ ...selection, fromDate: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({ ...selection, fromDate: "2026-12-01" }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({
        ...selection,
        fromDate: "2026-08-01T00:00:00Z",
      }),
    ).toThrow();
    expect(() =>
      buildSaturnViewportQuery({ ...selection, toDate: "2026-13-01" }),
    ).toThrow();
  });

  it("parses the observed first page as map indices, not treatment facts", () => {
    const page = parseSaturnViewportPage(observedResponse, request);
    expect(page.totalElements).toBe(22);
    expect(page.totalPages).toBe(3);
    expect(page.entries).toHaveLength(10);
    expect(page.nextPage).toBe(1);
    expect(page.entries[0]).toEqual({
      featureId: "2038836",
      planId: "1811436",
      centerX: 32.917616,
      centerY: 55.088542,
    });
    expect(
      page.entries.slice(0, 7).every((entry) => entry.planId === "1811436"),
    ).toBe(true);
    expect(page.entries[0]).not.toHaveProperty("geometry");
    expect(page.entries[0]).not.toHaveProperty("planDate");
  });

  it("derives only a bounded next page and stops at a synthetic terminal page", () => {
    const nextRequest = buildSaturnViewportQuery({
      ...selection,
      pageNumber: 2,
    });
    const lastPage = {
      ...observedResponse,
      number: 2,
      totalElements: 22,
      totalPages: 3,
      first: false,
      last: true,
      numberOfElements: 2,
      empty: false,
      content: (observedResponse.content as unknown[]).slice(0, 2),
      pageable: { pageNumber: 2, pageSize: 10 },
    };
    expect(parseSaturnViewportPage(lastPage, nextRequest).nextPage).toBeNull();
    expect(() => parseSaturnViewportPage(lastPage, request)).toThrow();
  });

  it("handles a synthetic empty final listing without claiming historical coverage", () => {
    const emptyPage = {
      ...observedResponse,
      content: [],
      totalElements: 0,
      totalPages: 0,
      numberOfElements: 0,
      last: true,
      empty: true,
    };
    const parsed = parseSaturnViewportPage(emptyPage, request);
    expect(parsed.entries).toEqual([]);
    expect(parsed.nextPage).toBeNull();
    expect(parsed).not.toHaveProperty("coverageVerified");
  });

  it("refuses mismatched provider pagination, omissions and truncated responses", () => {
    expect(() =>
      parseSaturnViewportPage({ ...observedResponse, number: 1 }, request),
    ).toThrow();
    expect(() =>
      parseSaturnViewportPage({ ...observedResponse, totalPages: 2 }, request),
    ).toThrow();
    expect(() =>
      parseSaturnViewportPage({ ...observedResponse, last: true }, request),
    ).toThrow();
    expect(() =>
      parseSaturnViewportPage({ ...observedResponse, content: [] }, request),
    ).toThrow();
    expect(() =>
      parseSaturnViewportPage(
        { ...observedResponse, totalElements: 9 },
        request,
      ),
    ).toThrow();
    expect(() =>
      parseSaturnViewportPage(
        { ...observedResponse, numberOfElements: 9 },
        request,
      ),
    ).toThrow();
    expect(() =>
      parseSaturnViewportPage({ ...observedResponse, size: 100 }, request),
    ).toThrow();
  });

  it("refuses duplicate map feature IDs and malformed summary coordinates", () => {
    const entries = observedResponse.content as Array<Record<string, unknown>>;
    expect(() =>
      parseSaturnViewportPage(
        {
          ...observedResponse,
          content: [entries[0], entries[0], ...entries.slice(2)],
        },
        request,
      ),
    ).toThrow();
    expect(() =>
      parseSaturnViewportPage(
        {
          ...observedResponse,
          content: [{ ...entries[0], centerY: 150 }, ...entries.slice(1)],
        },
        request,
      ),
    ).toThrow();
  });

  it("never treats unverified filters or map-index responses as full treatment evidence", () => {
    const unsupported = {
      ...request,
      filter: { ...request.filter, beekeperSearchFilter: { district: 1477 } },
    };
    expect(() =>
      parseSaturnViewportPage(observedResponse, unsupported as typeof request),
    ).toThrow();
    expect(() =>
      parseSaturnViewportPage({ content: observedResponse.content }, request),
    ).toThrow();
  });
});
