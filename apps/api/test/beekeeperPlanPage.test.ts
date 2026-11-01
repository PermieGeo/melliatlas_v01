// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.EXTRACTION
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
