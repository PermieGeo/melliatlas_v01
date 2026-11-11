// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it, vi } from "vitest";
import {
  SaturnViewportCollectionService,
  makeViewportFirstRequest,
} from "../src/modules/sources/providers/saturn/saturnViewportCollection.js";
import {
  viewportCollectionSelectionSchema,
  type ViewportCollectionSelection,
} from "@melliatlas/contracts";
import type { Pool } from "pg";
import type {
  SaturnViewportIndexRepository,
  ViewportIndexStatus,
} from "../src/modules/sources/providers/saturn/saturnViewportIndexRepository.js";
import type { RestrictedSourceFetcher } from "../src/modules/sources/httpFetcher.js";
import {
  SaturnProvider,
  type SaturnProviderPort,
} from "../src/modules/sources/providers/saturn/SaturnProvider.js";

const selected: ViewportCollectionSelection = {
  regionCode: "55",
  districtId: 1477,
  bbox: {
    west: 32.409804730540266,
    south: 54.92780435298192,
    east: 33.02984562409493,
    north: 55.210325361370735,
  },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
};
const entry = (id: number) => ({
  id,
  planId: 100,
  name: "FICTIONAL field",
  centerX: 32.5,
  centerY: 55,
});
const page = (n: number, total = 11) => ({
  content:
    n === 0 ? Array.from({ length: 10 }, (_, i) => entry(i + 1)) : [entry(11)],
  pageable: { pageNumber: n, pageSize: 10 },
  totalPages: 2,
  totalElements: total,
  last: n === 1,
  first: n === 0,
  numberOfElements: n === 0 ? 10 : 1,
  number: n,
  size: 10,
  empty: false,
});
function setup(provider?: SaturnProviderPort) {
  let status: ViewportIndexStatus | null = null;
  const query = vi.fn(async (sql: string) =>
    sql.includes("FROM source_saturn_regions")
      ? { rows: [{ subject_code: "55" }] }
      : sql.includes("FROM source_saturn_district_catalog")
        ? {
            rows: [
              {
                catalog: [
                  {
                    id: 1477,
                    name: "Yartsevo",
                    latitude: 55.06,
                    longitude: 32.68,
                  },
                ],
                retrieved_at: new Date("2026-11-07T00:00:00.000Z"),
              },
            ],
          }
        : {
            rows: [
              {
                registry_revision: "1",
                name: "Fixture Saturn",
                kind: "treatment",
                lifecycle: "configured",
                url: "https://bee-saturn.ru/backend/beemaster/planapplybees",
                api_request_config: {
                  endpoint:
                    "https://bee-saturn.ru/backend/beemaster/planapplybees",
                },
              },
            ],
          },
  );
  const reserve = vi.fn(async () => true);
  const fetch = vi.fn(async (_source: unknown, request: { body?: string }) => ({
    bytes: Buffer.from(
      JSON.stringify(
        page(JSON.parse(request.body ?? "{}").pageNumber as number),
      ),
    ),
    canonicalUrl: "https://bee-saturn.ru/backend/beemaster/query",
    contentType: "application/json",
  }));
  const getStatus = vi.fn(async () => status);
  const appendCapturedPage = vi.fn(async (_key: unknown, body: unknown) => {
    const data = body as ReturnType<typeof page>;
    status = {
      requestHash: "a".repeat(64),
      state: data.last ? "viewport_index_complete" : "partial",
      nextPage: data.last ? null : data.number + 1,
      pagesFetched: data.number + 1,
      entriesReceived: data.numberOfElements + data.number * 10,
      totalPages: data.totalPages,
      totalElements: data.totalElements,
      completedAt: data.last ? "2026-11-07T00:00:00.000Z" : null,
      sourceRevisionCurrent: true,
    };
    return status;
  });
  const index = {
    getStatus,
    appendCapturedPage,
    listFeatures: vi.fn(async () => [
      { featureId: "1", planId: "100", centerX: 32.5, centerY: 55 },
    ]),
  } as unknown as SaturnViewportIndexRepository;
  const journal = {
    start: vi.fn(async () => "1"),
    finish: vi.fn(async () => {}),
    list: vi.fn(async () => ({ entries: [] })),
  };
  const service = new SaturnViewportCollectionService(
    { query } as unknown as Pool,
    true,
    {
      index,
      journal,
      gate: { reserve },
      fetcher: { fetch } as unknown as RestrictedSourceFetcher,
      provider,
    },
  );
  return { service, query, reserve, fetch, appendCapturedPage, index, journal };
}

describe("explicit Saturn viewport retrieval", () => {
  it("accepts a bounded viewport outside Smolensk only with an explicit region code", () => {
    expect(
      viewportCollectionSelectionSchema.safeParse({
        ...selected,
        regionCode: "77",
        bbox: {
          west: 60,
          south: 40,
          east: 60.3,
          north: 40.3,
        },
      }).success,
    ).toBe(true);
    expect(
      viewportCollectionSelectionSchema.safeParse({
        ...selected,
        regionCode: "",
        bbox: {
          west: 60,
          south: 40,
          east: 60.3,
          north: 40.3,
        },
      }).success,
    ).toBe(false);
  });
  it("delegates source query and response parsing through its provider port", async () => {
    const provider = new SaturnProvider();
    const firstPage = vi.spyOn(provider, "firstPage");
    const pageAt = vi.spyOn(provider, "pageAt");
    const parsePage = vi.spyOn(provider, "parsePage");
    const { service } = setup(provider);
    await service.fetchNext(selected);
    expect(firstPage).toHaveBeenCalledWith(selected);
    expect(pageAt).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 0 }),
      0,
    );
    expect(parsePage).toHaveBeenCalledWith(
      expect.objectContaining({ totalElements: 11 }),
      expect.objectContaining({ pageNumber: 0 }),
    );
  });

  it("produces only the observed district, bbox, date and pagination envelope", () => {
    const request = makeViewportFirstRequest(selected);
    expect(request).toMatchObject({
      filter: {
        subject: "55",
        district: "1477",
        startDateUpdateMap: "2026-08-01T00:00:00.000Z",
      },
      pageSize: 10,
      pageNumber: 0,
    });
    expect(request.filter).not.toHaveProperty("queryText");
  });

  it("fetches one page per action, resumes and stops after the terminal page", async () => {
    const { service, fetch, reserve, appendCapturedPage, journal } = setup();
    expect((await service.status(selected)).progress).toBeNull();
    expect(await service.fetchNext(selected)).toMatchObject({
      progress: { nextPage: 1, pagesFetched: 1 },
      cachedCenters: [{ featureId: "1", planId: "100" }],
    });
    expect(await service.fetchNext(selected)).toMatchObject({
      progress: {
        nextPage: null,
        pagesFetched: 2,
        state: "viewport_index_complete",
      },
    });
    expect(await service.fetchNext(selected)).toMatchObject({
      progress: { state: "viewport_index_complete" },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(appendCapturedPage).toHaveBeenCalledTimes(2);
    expect(journal.start).toHaveBeenCalledTimes(3);
    expect(journal.finish).toHaveBeenNthCalledWith(3, "1", "cache_hit", 0);
    const request = fetch.mock.calls[1]?.[1];
    expect(JSON.parse(request?.body ?? "{}").pageNumber).toBe(1);
  });

  it("disables all live traffic without an explicit backend opt-in", async () => {
    const { service, fetch, reserve, query, index } = setup();
    await service.fetchNext(selected);
    const disabled = new SaturnViewportCollectionService(
      { query } as unknown as Pool,
      false,
      { index },
    );
    expect(await disabled.status(selected)).toMatchObject({
      enabled: false,
      progress: { pagesFetched: 1 },
      cachedCenters: [{ featureId: "1" }],
    });
    await expect(disabled.fetchNext(selected)).rejects.toMatchObject({
      code: "SATURN_VIEWPORT_DISABLED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(service).toBeTruthy();
  });

  it("rejects uncontrolled regions, malformed dates, and excessive spatial windows", () => {
    expect(
      viewportCollectionSelectionSchema.safeParse({
        ...selected,
        districtId: -1,
      }).success,
    ).toBe(false);
    expect(
      viewportCollectionSelectionSchema.safeParse({
        ...selected,
        fromDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      viewportCollectionSelectionSchema.safeParse({
        ...selected,
        bbox: { ...selected.bbox, east: 35 },
      }).success,
    ).toBe(false);
    expect(
      viewportCollectionSelectionSchema.safeParse({
        ...selected,
        toDate: "2027-11-30",
      }).success,
    ).toBe(false);
  });

  it("does not contact upstream when the database-wide throttle rejects the request", async () => {
    const { service, reserve, fetch, journal } = setup();
    reserve.mockResolvedValueOnce(false);
    await expect(service.fetchNext(selected)).rejects.toMatchObject({
      code: "SOURCE_THROTTLED",
      statusCode: 429,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(journal.finish).toHaveBeenCalledWith(
      "1",
      "throttled",
      0,
      "SOURCE_THROTTLED",
    );
  });

  it("refuses a different configured endpoint before reserving or fetching", async () => {
    const { service, query, reserve, fetch } = setup();
    query.mockResolvedValueOnce({
      rows: [
        {
          registry_revision: "1",
          kind: "treatment",
          lifecycle: "configured",
          name: "Other",
          url: "https://example.org/endpoint",
          api_request_config: { endpoint: "https://example.org/endpoint" },
        },
      ],
    });
    await expect(service.fetchNext(selected)).rejects.toMatchObject({
      code: "SATURN_VIEWPORT_NOT_CONFIGURED",
    });
    expect(reserve).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts another directory-listed district, but rejects unknown district IDs", async () => {
    const { service } = setup();
    const selectedOther = { ...selected, districtId: 2670 };
    await expect(service.status(selectedOther)).rejects.toMatchObject({
      code: "DISTRICT_NOT_IN_CATALOG",
    });
    const listed = new SaturnViewportCollectionService(
      {
        query: vi.fn(async () => ({
          rows: [
            {
              registry_revision: "1",
              name: "Fixture",
              kind: "treatment",
              lifecycle: "configured",
              url: "https://bee-saturn.ru/backend/beemaster/query",
              api_request_config: {
                endpoint: "https://bee-saturn.ru/backend/beemaster/query",
              },
            },
          ],
        })),
      } as unknown as Pool,
      true,
      {
        directory: {
          includesRegion: vi.fn(async () => true),
          includes: vi.fn(async () => true),
          list: vi.fn(),
          refresh: vi.fn(),
        } as never,
        index: {
          getStatus: vi.fn(async () => null),
          listFeatures: vi.fn(async () => []),
          appendCapturedPage: vi.fn(),
        } as never,
      },
    );
    expect((await listed.status(selectedOther)).progress).toBeNull();
  });

  it("never commits a malformed upstream page", async () => {
    const { service, fetch, appendCapturedPage, journal } = setup();
    fetch.mockResolvedValueOnce({
      bytes: Buffer.from('{"content":[]}'),
      canonicalUrl: "https://bee-saturn.ru/backend/beemaster/query",
      contentType: "application/json",
    });
    await expect(service.fetchNext(selected)).rejects.toMatchObject({
      code: "INVALID_SOURCE_RESPONSE",
    });
    expect(appendCapturedPage).not.toHaveBeenCalled();
    expect(journal.finish).toHaveBeenCalledWith(
      "1",
      "failed",
      0,
      "INVALID_SOURCE_RESPONSE",
    );
  });
});
