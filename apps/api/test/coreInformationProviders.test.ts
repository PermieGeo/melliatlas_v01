import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createCore,
  createCoreProviderRegistry,
  InformationProviderRegistry,
  SATURN_CACHE_PROVIDER_ID,
  WEATHER_PROVIDER_ID,
} from "../src/modules/core/index.js";

const point = { lat: 55.0, lon: 33.0 };
const weatherResponse = {
  point,
  weather: {
    temperatureC: 17,
    relativeHumidityPct: 60,
    windSpeedMs: 2,
    windDirectionDeg: 180,
    precipitationMm: 0,
  },
  provenance: {
    sourceId: "open-meteo",
    sourceName: "Open-Meteo forecast",
    sourceUrl: "https://api.open-meteo.com/v1/forecast",
    retrievedAt: "2026-11-11T08:00:00.000Z",
    observedAt: "2026-11-11T07:00:00.000Z",
    nature: "forecast_model" as const,
  },
};
const selection = {
  regionCode: "55",
  districtId: 1477,
  bbox: { west: 32.2, south: 54.9, east: 33, north: 55.4 },
  fromDate: "2026-10-01",
  toDate: "2026-11-01",
};

describe("core information provider registry", () => {
  it("registers the existing weather and read-only Saturn capabilities", async () => {
    const inspect = vi.fn(async () => weatherResponse);
    const status = vi.fn(async () => ({
      enabled: false,
      progress: null,
      cachedCenters: [],
    }));
    const registry = createCoreProviderRegistry({
      weather: { inspect },
      saturn: { status },
    });

    expect(registry.list()).toEqual([
      { id: WEATHER_PROVIDER_ID, capability: "weather.point_forecast" },
      {
        id: SATURN_CACHE_PROVIDER_ID,
        capability: "treatment.viewport_index_cache",
      },
    ]);
    expect((await registry.read(WEATHER_PROVIDER_ID, point)).data).toEqual(
      weatherResponse,
    );
    expect(inspect).toHaveBeenCalledWith(point);
    expect(
      (await registry.read(SATURN_CACHE_PROVIDER_ID, selection)).data,
    ).toEqual({
      enabled: false,
      progress: null,
      cachedCenters: [],
    });
    expect(status).toHaveBeenCalledOnce();
    expect(status).toHaveBeenCalledWith(selection);
  });

  it("keeps the weather inspection entry point working through core", async () => {
    const inspect = vi.fn(async () => weatherResponse);
    const core = createCore({
      weather: { inspect },
      saturn: { status: vi.fn() },
    });
    expect(await core.inspectWeather(point)).toEqual(weatherResponse);
  });

  it("rejects invalid inputs before consulting the source", async () => {
    const inspect = vi.fn(async () => weatherResponse);
    const status = vi.fn(async () => ({
      enabled: false,
      progress: null,
      cachedCenters: [],
    }));
    const registry = createCoreProviderRegistry({
      weather: { inspect },
      saturn: { status },
    });
    await expect(
      registry.read(WEATHER_PROVIDER_ID, { lat: 200, lon: 33 }),
    ).rejects.toThrow();
    await expect(
      registry.read(SATURN_CACHE_PROVIDER_ID, {
        ...selection,
        fromDate: "2026-01-01",
      }),
    ).rejects.toThrow();
    expect(inspect).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("rejects malformed output rather than publishing synthetic evidence", async () => {
    const registry = createCoreProviderRegistry({
      weather: {
        inspect: vi.fn(async () => ({ ...weatherResponse, weather: {} })),
      },
      saturn: { status: vi.fn() },
    });
    await expect(registry.read(WEATHER_PROVIDER_ID, point)).rejects.toThrow();
  });

  it("rejects unknown and duplicate registrations", async () => {
    const registry = new InformationProviderRegistry();
    const provider = {
      descriptor: { id: "custom", capability: "testing.values" },
      inputSchema: z.number(),
      outputSchema: z.number(),
      read: async (input: number) => input * 2,
    };
    registry.register(provider);
    expect(() => registry.register(provider)).toThrow("Duplicate");
    await expect(registry.read("unknown", 2)).rejects.toThrow("Unknown");
    expect((await registry.read("custom", 2)).data).toBe(4);
  });
});
