// Feature IDs: NOTICES.MAP_OVERLAY, WEATHER.POINT_FORECAST
import { afterEach, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  inspectLocation,
  loadMapTreatments,
  loadDistrictViewportProgress,
  fetchDistrictViewportPage,
} from "./client";

const point = { lat: 54.78, lon: 32.05 };
afterEach(() => vi.unstubAllGlobals());
it("fetches verified map results from the public endpoint only", async () => {
  const fetcher = vi.fn(
    async (_url: string, _options?: RequestInit) =>
      new Response(JSON.stringify({ notices: [] })),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(await loadMapTreatments(new AbortController().signal)).toEqual([]);
  expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/notices");
});
it("rejects invalid map responses instead of displaying unsupported records", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(JSON.stringify({ notices: [{ geometry: {} }] })),
    ),
  );
  await expect(
    loadMapTreatments(new AbortController().signal),
  ).rejects.toThrow();
});
it("converts server error envelopes into language-independent codes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "SOURCE_UNAVAILABLE",
              message: "private error",
              requestId: "test",
            },
          }),
          { status: 503 },
        ),
    ),
  );
  await expect(
    inspectLocation(point, new AbortController().signal),
  ).rejects.toMatchObject({
    code: "SOURCE_UNAVAILABLE",
  } satisfies Partial<ApiRequestError>);
});

it("requests only the visible viewport from local stored notices", async () => {
  const fetcher = vi.fn(
    async (_url: string, _options?: RequestInit) =>
      new Response(JSON.stringify({ notices: [] })),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await loadMapTreatments(new AbortController().signal, [31, 53, 33, 55]),
  ).toEqual([]);
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    "/api/v1/notices?bbox=31.000000,53.000000,33.000000,55.000000",
  );
});

it("sends an explicit bounded viewport index request through the non-operator client boundary", async () => {
  const fetcher = vi.fn(
    async (_url: string, _options?: RequestInit) =>
      new Response(JSON.stringify({ enabled: true, progress: null })),
  );
  vi.stubGlobal("fetch", fetcher);
  const selected = {
    regionCode: "55",
    districtId: 1477 as const,
    bbox: { west: 32.41, south: 54.93, east: 33.03, north: 55.21 },
    fromDate: "2026-08-01",
    toDate: "2026-11-30",
  };
  expect(await loadDistrictViewportProgress(selected)).toEqual({
    enabled: true,
    progress: null,
  });
  expect(await fetchDistrictViewportPage(selected)).toEqual({
    enabled: true,
    progress: null,
  });
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/v1/map/saturn-viewport/status",
    "/api/v1/map/saturn-viewport/next",
  ]);
  expect(
    fetcher.mock.calls.every((call) => !String(call[0]).includes("/operator/")),
  ).toBe(true);
  const nextRequest = fetcher.mock.calls[1]?.[1] as RequestInit;
  expect(nextRequest.method).toBe("POST");
  expect(JSON.parse(String(nextRequest.body))).toMatchObject(selected);
});
