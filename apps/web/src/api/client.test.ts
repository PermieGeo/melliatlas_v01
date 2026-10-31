// Feature IDs: SOURCES.CATALOG, WEATHER.POINT_FORECAST
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectLocation, loadSourceCatalog } from "./client";

const forecast = {
  point: { lat: 54.78, lon: 32.05 },
  weather: {
    temperatureC: 10,
    relativeHumidityPct: 75,
    windSpeedMs: 1.5,
    windDirectionDeg: 90,
    precipitationMm: 0.1,
  },
  provenance: {
    sourceId: "test-forecast",
    sourceName: "Synthetic test forecast",
    sourceUrl: "https://example.invalid/source",
    observedAt: "2026-10-31T08:00:00.000Z",
    retrievedAt: "2026-10-31T08:03:00.000Z",
    nature: "forecast_model",
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("HTTP client and shared wire schemas", () => {
  it("sends coordinates and cancellation signal and returns validated provenance", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Response(JSON.stringify(forecast)),
    );
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const result = await inspectLocation(forecast.point, controller.signal);
    expect(result.provenance.sourceId).toBe("test-forecast");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("lat=54.78&lon=32.05");
    expect(fetcher.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });

  it("rejects incomplete forecast payloads without inventing readings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ point: forecast.point })),
      ),
    );
    await expect(
      inspectLocation(forecast.point, new AbortController().signal),
    ).rejects.toThrow();
  });

  it("turns typed source failures into a helpful message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "SOURCE_UNAVAILABLE",
                message: "upstream secret",
                requestId: "request-1",
              },
            }),
            { status: 503 },
          ),
      ),
    );
    await expect(
      inspectLocation(forecast.point, new AbortController().signal),
    ).rejects.toThrow(
      "Источник данных временно недоступен. Повторите запрос позже.",
    );
  });

  it("rejects malformed source catalogs instead of displaying unverified entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              sources: [{ id: "source-1", name: "Unverified" }],
            }),
          ),
      ),
    );
    await expect(
      loadSourceCatalog(new AbortController().signal),
    ).rejects.toThrow();
  });

  it("reports invalid error envelopes without leaking server data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("debug internals", { status: 502 })),
    );
    await expect(
      loadSourceCatalog(new AbortController().signal),
    ).rejects.toThrow("Ошибка запроса к серверу (502)");
  });
});
