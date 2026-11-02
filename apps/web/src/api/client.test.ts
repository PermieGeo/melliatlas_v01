import { afterEach, expect, it, vi } from "vitest";
import { ApiRequestError, inspectLocation, loadMapTreatments } from "./client";

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
