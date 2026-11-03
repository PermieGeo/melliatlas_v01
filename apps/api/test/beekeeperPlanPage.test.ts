// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.EXTRACTION
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBeekeeperPlanPage } from "../src/modules/sources/beekeeperPlanPage.js";

describe("published treatment plan page parsing", () => {
  it("keeps original plan IDs, UTC dates and GeoJSON longitude-latitude order", () => {
    const page = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            planId: 42,
            contractorName: "Farm A",
            cadNum: "67:01:1:7",
            planDate: 1793491200,
            planDateEnd: 1793577600,
            geo: {
              type: "Polygon",
              coordinates: [
                [
                  [32, 54],
                  [33, 54],
                  [33, 55],
                  [32, 54],
                ],
              ],
            },
          },
          allPatList: [
            {
              patName: "Published product",
              regulationCropName: "Oilseed rape",
              patProductDangerClassBee: 2,
            },
          ],
        },
      ],
      totalElements: 100,
    });
    expect(page.totalElements).toBe(100);
    expect(page.plans[0]).toMatchObject({
      externalId: "42",
      contractorName: "Farm A",
      cadastralNumber: "67:01:1:7",
    });
    expect(page.plans[0].geometry).toMatchObject({
      type: "Polygon",
      coordinates: [
        [
          [32, 54],
          [33, 54],
          [33, 55],
          [32, 54],
        ],
      ],
    });
    expect(page.plans[0].treatments).toEqual([
      { name: "Published product", crop: "Oilseed rape", beeHazardClass: 2 },
    ]);
    expect(page.plans[0].startAt).toMatch(/Z$/);
  });

  it("does not fill in missing IDs, polygons, toxicity or publication dates", () => {
    const page = parseBeekeeperPlanPage({
      content: [{ beeAcreage: {}, allPatList: [{}] }],
    });
    expect(page.totalElements).toBeNull();
    expect(page.plans[0]).toEqual({
      externalId: null,
      contractorName: null,
      cadastralNumber: null,
      startAt: null,
      endAt: null,
      geometry: null,
      treatments: [{ name: null, crop: null, beeHazardClass: null }],
    });
  });

  it("keeps a real polygon when optional provider fields are null or unexpectedly typed", () => {
    const geometry = {
      type: "Polygon" as const,
      coordinates: [
        [
          [32, 54],
          [33, 54],
          [33, 55],
          [32, 54],
        ],
      ],
    };
    const result = parseBeekeeperPlanPage({
      totalElements: 21661,
      content: [
        {
          id: 21,
          beeAcreage: {
            planId: null,
            contractorName: null,
            cadNum: 42,
            planDate: "1793491200",
            planDateEnd: null,
            geo: geometry,
          },
          allPatList: [
            null,
            {
              patName: null,
              regulationCropName: false,
              patProductDangerClassBee: null,
            },
            { patName: " Product ", patProductDangerClassBee: "2" },
          ],
        },
        { beeAcreage: null, allPatList: null },
      ],
    });
    expect(result.totalElements).toBe(21661);
    expect(result.plans).toHaveLength(2);
    expect(result.plans[0]).toMatchObject({
      externalId: "21",
      contractorName: null,
      cadastralNumber: null,
      endAt: null,
      geometry,
      treatments: [
        { name: null, crop: null, beeHazardClass: null },
        { name: "Product", crop: null, beeHazardClass: 2 },
      ],
    });
    expect(result.plans[0].startAt).toMatch(/Z$/);
    expect(result.plans[1]).toMatchObject({
      externalId: null,
      geometry: null,
      treatments: [],
    });
  });

  it("rejects Saturn map-query summaries instead of storing parcel centers as treatment evidence", () => {
    const sample = JSON.parse(
      readFileSync(
        new URL("./fixtures/saturn-map-query-response.json", import.meta.url),
        "utf8",
      ),
    ) as unknown;
    expect(() => parseBeekeeperPlanPage(sample)).toThrow(
      "Saturn map-query summaries cannot be ingested as treatment plans",
    );
    expect(() =>
      parseBeekeeperPlanPage({
        content: [{ beeAcreage: null, allPatList: null }],
      }),
    ).not.toThrow();
  });

  it("rejects malformed page envelopes instead of silently dropping records", () => {
    expect(() => parseBeekeeperPlanPage({ content: [null] })).toThrow();
    expect(() =>
      parseBeekeeperPlanPage({ content: [{}], totalElements: -1 }),
    ).toThrow();
    expect(() =>
      parseBeekeeperPlanPage({
        content: Array.from({ length: 201 }, () => ({})),
      }),
    ).toThrow();
  });

  it("accepts a source-published numeric hazard class encoded as a string", () => {
    const result = parseBeekeeperPlanPage({
      content: [{ allPatList: [{ patProductDangerClassBee: "1" }] }],
    });
    expect(result.plans[0].treatments[0].beeHazardClass).toBe(1);
  });

  it("rejects malformed pages but keeps invalid geometries text-only", () => {
    expect(() => parseBeekeeperPlanPage({ content: "unexpected" })).toThrow();
    const page = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            geo: {
              type: "Polygon",
              coordinates: [
                [
                  [1000, 0],
                  [32, 54],
                  [32, 55],
                  [1000, 0],
                ],
              ],
            },
          },
        },
      ],
    });
    expect(page.plans).toHaveLength(1);
    expect(page.plans[0].geometry).toBeNull();
  });
});

it("preserves page records when one provider geometry is malformed", () => {
  const parsed = parseBeekeeperPlanPage({
    content: [
      {
        id: "bad-geo",
        beeAcreage: { geo: { type: "Polygon", coordinates: [[[320, 54]]] } },
      },
      {
        id: "good-geo",
        beeAcreage: {
          geo: {
            type: "Polygon",
            coordinates: [
              [
                [32, 54],
                [33, 54],
                [33, 55],
                [32, 54],
              ],
            ],
          },
        },
      },
    ],
  });
  expect(parsed.plans).toHaveLength(2);
  expect(parsed.plans[0].geometry).toBeNull();
  expect(parsed.plans[1].geometry?.type).toBe("Polygon");
});
