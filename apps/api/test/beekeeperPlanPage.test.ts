// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.EXTRACTION
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBeekeeperPlanPage } from "../src/modules/sources/beekeeperPlanPage.js";

describe("published treatment plan page parsing", () => {
  it("keeps distinct field and plan IDs, UTC dates and GeoJSON longitude-latitude order", () => {
    const page = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            id: 420,
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
      externalId: "420",
      planId: "42",
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

  it("preserves each field's source publication date, distinct from treatment dates", () => {
    const firstPublication = 1785000000;
    const secondPublication = 1785100000;
    const parsed = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            id: 8001,
            planId: 9001,
            datePublishing: firstPublication,
            planDate: 1785200000,
            planDateEnd: 1785200000,
          },
        },
        {
          beeAcreage: {
            id: 8002,
            planId: 9001,
            datePublishing: secondPublication,
            isUpdated: true,
            planDate: 1785200000,
            planDateEnd: 1785200000,
            planDateUpdate: 1785300000,
            planDateEndUpdate: 1785300000,
          },
        },
        { beeAcreage: { id: 8003, planId: 9002, datePublishing: "invalid" } },
        { beeAcreage: { id: 8004, planId: 9002, datePublishing: 0 } },
      ],
    });
    expect(parsed.plans.map((plan) => plan.publishedAt)).toEqual([
      new Date(firstPublication * 1000).toISOString(),
      new Date(secondPublication * 1000).toISOString(),
      null,
      null,
    ]);
    expect(parsed.plans[0]?.startAt).toBe(
      new Date(1785200000 * 1000).toISOString(),
    );
    expect(parsed.plans[1]?.startAt).toBe(
      new Date(1785300000 * 1000).toISOString(),
    );
  });

  it("reads Spring pagination metadata without coupling records to a page number", () => {
    const page = parseBeekeeperPlanPage({
      content: [{ beeAcreage: { id: 701, planId: 99 } }],
      number: 3,
      size: 10,
      numberOfElements: 1,
      totalPages: 4,
      totalElements: 31,
      last: true,
      pageable: { pageNumber: 3, pageSize: 10 },
    });
    expect(page.pagination).toEqual({
      number: 3,
      size: 10,
      numberOfElements: 1,
      totalPages: 4,
      last: true,
    });
    expect(page.plans[0]).toMatchObject({ externalId: "701", planId: "99" });
    expect(parseBeekeeperPlanPage({ content: [{}] }).pagination).toEqual({
      number: null,
      size: null,
      numberOfElements: null,
      totalPages: null,
      last: null,
    });
  });

  it("rejects conflicting page metadata rather than picking one of two page numbers", () => {
    expect(() =>
      parseBeekeeperPlanPage({
        content: [],
        number: 0,
        pageable: { pageNumber: 1, pageSize: 10 },
      }),
    ).toThrow();
    expect(() =>
      parseBeekeeperPlanPage({
        content: [],
        size: 10,
        pageable: { pageNumber: 0, pageSize: 20 },
      }),
    ).toThrow();
  });

  it("does not fill in missing IDs, polygons, toxicity or publication dates", () => {
    const page = parseBeekeeperPlanPage({
      content: [{ beeAcreage: {}, allPatList: [{}] }],
    });
    expect(page.totalElements).toBeNull();
    expect(page.plans[0]).toEqual({
      externalId: null,
      planId: null,
      isUpdated: null,
      contractorName: null,
      cadastralNumber: null,
      startAt: null,
      endAt: null,
      publishedAt: null,
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
      externalId: null,
      planId: null,
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

  it("keeps separate fields even when they belong to one shared plan", () => {
    const result = parseBeekeeperPlanPage({
      content: [
        { beeAcreage: { id: 1001, planId: 70 } },
        { beeAcreage: { id: 1002, planId: 70 } },
        { id: 1003, beeAcreage: { planId: 70 } },
      ],
    });
    expect(
      result.plans.map(({ externalId, planId }) => ({ externalId, planId })),
    ).toEqual([
      { externalId: "1001", planId: "70" },
      { externalId: "1002", planId: "70" },
      { externalId: null, planId: "70" },
    ]);
  });

  it("uses revised dates and source-selected treatments for updated records", () => {
    const result = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            id: 55,
            planId: 5,
            isUpdated: true,
            planDate: 1793491200,
            planDateEnd: 1793577600,
            planDateUpdate: 1793664000,
            planDateEndUpdate: 1793750400,
            patIds: "10",
            patIdsUpdate: "20",
          },
          allPatList: [{ patId: 20, patName: "Revised product" }],
        },
        {
          beeAcreage: {
            id: 56,
            isUpdated: false,
            planDate: 1793491200,
            planDateEnd: 1793577600,
            planDateUpdate: 1793664000,
            planDateEndUpdate: 1793750400,
          },
        },
        {
          beeAcreage: {
            id: 57,
            isUpdated: true,
            planDate: 1793491200,
            planDateEnd: 1793577600,
            planDateUpdate: null,
            planDateEndUpdate: "invalid",
          },
        },
      ],
    });
    expect(result.plans[0]).toMatchObject({
      externalId: "55",
      planId: "5",
      isUpdated: true,
      startAt: new Date(1793664000 * 1000).toISOString(),
      endAt: new Date(1793750400 * 1000).toISOString(),
      treatments: [
        { name: "Revised product", crop: null, beeHazardClass: null },
      ],
    });
    expect(result.plans[1].startAt).toBe(
      new Date(1793491200 * 1000).toISOString(),
    );
    expect(result.plans[1].endAt).toBe(
      new Date(1793577600 * 1000).toISOString(),
    );
    expect(result.plans[2]).toMatchObject({ startAt: null, endAt: null });
  });

  it("treats inverted original and revised treatment periods as unknown without discarding other claims", () => {
    const start = 1793664000;
    const end = 1793577600;
    const page = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            id: 8801,
            planId: 510,
            planDate: start,
            planDateEnd: end,
            datePublishing: 1793491200,
          },
          allPatList: [{ patName: "Original product" }],
        },
        {
          beeAcreage: {
            id: 8802,
            planId: 510,
            isUpdated: true,
            planDate: end,
            planDateEnd: start,
            planDateUpdate: start,
            planDateEndUpdate: end,
          },
        },
        {
          beeAcreage: {
            id: 8803,
            planId: 510,
            planDate: end,
            planDateEnd: start,
          },
        },
        {
          beeAcreage: {
            id: 8804,
            planId: 510,
            planDate: start,
            planDateEnd: start,
          },
        },
      ],
    });
    expect(page.plans[0]).toMatchObject({
      externalId: "8801",
      planId: "510",
      startAt: null,
      endAt: null,
      publishedAt: new Date(1793491200 * 1000).toISOString(),
      treatments: [
        { name: "Original product", crop: null, beeHazardClass: null },
      ],
    });
    expect(page.plans[1]).toMatchObject({
      externalId: "8802",
      isUpdated: true,
      startAt: null,
      endAt: null,
    });
    expect(page.plans[2]).toMatchObject({
      externalId: "8803",
      startAt: new Date(end * 1000).toISOString(),
      endAt: new Date(start * 1000).toISOString(),
    });
    expect(page.plans[3]).toMatchObject({
      externalId: "8804",
      startAt: new Date(start * 1000).toISOString(),
      endAt: new Date(start * 1000).toISOString(),
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

  it("accepts WGS84 boundary coordinates in longitude-latitude order", () => {
    const coordinates = [
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, -90],
    ];
    const parsed = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            geo: { type: "Polygon", coordinates: [coordinates] },
          },
        },
      ],
    });
    expect(parsed.plans[0].geometry).toMatchObject({
      type: "Polygon",
      coordinates: [coordinates],
    });

    for (const invalidCoordinate of [
      [-180.01, -90],
      [180.01, 90],
      [0, -90.01],
      [0, 90.01],
    ]) {
      const invalid = parseBeekeeperPlanPage({
        content: [
          {
            beeAcreage: {
              geo: {
                type: "Polygon",
                coordinates: [
                  [invalidCoordinate, [32, 54], [33, 54], invalidCoordinate],
                ],
              },
            },
          },
        ],
      });
      expect(invalid.plans[0].geometry).toBeNull();
    }
  });

  it("accepts minimum polygon and multipolygon structures without claiming topological validity", () => {
    const ring = [
      [32, 54],
      [33, 54],
      [33, 55],
      [32, 54],
    ];
    const valid = parseBeekeeperPlanPage({
      content: [
        { beeAcreage: { geo: { type: "Polygon", coordinates: [ring] } } },
        {
          beeAcreage: {
            geo: { type: "MultiPolygon", coordinates: [[ring]] },
          },
        },
      ],
    });
    expect(valid.plans[0].geometry?.type).toBe("Polygon");
    expect(valid.plans[1].geometry?.type).toBe("MultiPolygon");

    const invalid = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            geo: { type: "Polygon", coordinates: [ring.slice(0, 3)] },
          },
        },
        { beeAcreage: { geo: { type: "Polygon", coordinates: [] } } },
        { beeAcreage: { geo: { type: "MultiPolygon", coordinates: [] } } },
        {
          beeAcreage: {
            geo: { type: "MultiPolygon", coordinates: [[]] },
          },
        },
      ],
    });
    expect(invalid.plans.every((plan) => plan.geometry === null)).toBe(true);

    // Closure is deliberately deferred to the PostGIS validity check in ingestion.
    const unclosed = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            geo: {
              type: "Polygon",
              coordinates: [
                [
                  [32, 54],
                  [33, 54],
                  [33, 55],
                  [32, 55],
                ],
              ],
            },
          },
        },
      ],
    });
    expect(unclosed.plans[0].geometry?.type).toBe("Polygon");
  });

  it("retains the 200-record page budget and supported Unix timestamp bounds", () => {
    const fullPage = parseBeekeeperPlanPage({
      content: Array.from({ length: 200 }, () => ({})),
    });
    expect(fullPage.plans).toHaveLength(200);

    const timestamps = parseBeekeeperPlanPage({
      content: [
        {
          beeAcreage: {
            planDate: "253402300799",
            planDateEnd: 253402300800,
          },
          allPatList: [
            { patProductDangerClassBee: "3" },
            { patProductDangerClassBee: 4 },
          ],
        },
      ],
    });
    expect(timestamps.plans[0].startAt).toBe("9999-12-31T23:59:59.000Z");
    expect(timestamps.plans[0].endAt).toBeNull();
    expect(
      timestamps.plans[0].treatments.map((item) => item.beeHazardClass),
    ).toEqual([3, null]);
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
