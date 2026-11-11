// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it, vi } from "vitest";
import type { ViewportCollectionSelection } from "@melliatlas/contracts";
import type { RestrictedSourceFetcher } from "../src/modules/sources/httpFetcher.js";
import { SourceFetchFailure } from "../src/modules/sources/sourceFetchFailure.js";
import { SaturnProvider } from "../src/modules/sources/providers/saturn/SaturnProvider.js";
import { SaturnViewportPageFetcher } from "../src/modules/sources/providers/saturn/saturnViewportPageFetcher.js";

const selection: ViewportCollectionSelection = {
  regionCode: "55",
  districtId: 1477,
  bbox: { west: 32.4, south: 54.92, east: 33.02, north: 55.21 },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
};

const body = {
  content: [
    { id: 238194, planId: 701, name: "FICTIONAL", centerX: 32.5, centerY: 55 },
  ],
  pageable: { pageNumber: 0, pageSize: 10 },
  totalPages: 1,
  totalElements: 1,
  last: true,
  first: true,
  numberOfElements: 1,
  number: 0,
  size: 10,
  empty: false,
};

function setup(bytes = Buffer.from(JSON.stringify(body))) {
  const fetch = vi.fn(async () => ({
    bytes,
    canonicalUrl: "https://bee-saturn.ru/backend/beemaster/query",
    contentType: "application/json",
  }));
  const provider = new SaturnProvider();
  return {
    pageFetcher: new SaturnViewportPageFetcher(
      { fetch } as unknown as Pick<RestrictedSourceFetcher, "fetch">,
      provider,
    ),
    fetch,
    firstPage: provider.firstPage(selection),
  };
}

describe("Saturn viewport page transport adapter", () => {
  it("uses only the registered POST destination and returns bounded validated evidence", async () => {
    const { pageFetcher, firstPage, fetch } = setup();
    expect(await pageFetcher.fetch("Fixture", firstPage, 0)).toEqual({
      body,
      receivedCount: 1,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ id: "treatment-feed" }),
      expect.objectContaining({
        url: "https://bee-saturn.ru/backend/beemaster/query",
        method: "POST",
        requestProfile: "saturn-json",
        body: JSON.stringify(firstPage),
      }),
    );
  });

  it("translates provider rate limits into the shared throttle error", async () => {
    const { pageFetcher, firstPage, fetch } = setup();
    fetch.mockRejectedValueOnce(new SourceFetchFailure("RATE_LIMITED"));
    await expect(
      pageFetcher.fetch("Fixture", firstPage, 0),
    ).rejects.toMatchObject({
      code: "SOURCE_THROTTLED",
      statusCode: 429,
    });
  });

  it("rejects malformed JSON without inventing or persisting a map feature", async () => {
    const { pageFetcher, firstPage } = setup(Buffer.from("{not-json"));
    await expect(
      pageFetcher.fetch("Fixture", firstPage, 0),
    ).rejects.toMatchObject({
      code: "INVALID_SOURCE_RESPONSE",
      statusCode: 502,
    });
  });

  it("rejects a response whose page number differs from the requested page", async () => {
    const { pageFetcher, firstPage } = setup(
      Buffer.from(JSON.stringify({ ...body, number: 1 })),
    );
    await expect(
      pageFetcher.fetch("Fixture", firstPage, 0),
    ).rejects.toMatchObject({
      code: "INVALID_SOURCE_RESPONSE",
    });
  });
});
