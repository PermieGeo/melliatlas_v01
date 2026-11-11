// Feature IDs: WEATHER.POINT_FORECAST
import { describe, expect, it, vi } from "vitest";
import { OpenMeteoAdapter } from "../src/modules/weather/openMeteo.js";

const sample = {
  current: {
    time: "2026-10-31T09:00",
    temperature_2m: 9.2,
    relative_humidity_2m: 78,
    wind_speed_10m: 2.1,
    wind_direction_10m: 235,
    precipitation: 0.3,
  },
};

describe("Open-Meteo adapter", () => {
  it("converts a schema-validated response with provenance", async () => {
    const http = vi.fn(
      async () => new Response(JSON.stringify(sample), { status: 200 }),
    );
    const adapter = new OpenMeteoAdapter(
      http,
      8000,
      () => new Date("2026-10-31T10:00:00.000Z"),
    );
    const result = await adapter.inspect({ lat: 54.78, lon: 32.05 });
    expect(result.weather.windSpeedMs).toBe(2.1);
    expect(result.provenance.observedAt).toBe("2026-10-31T09:00:00.000Z");
    expect(String(http.mock.calls[0]?.[0])).toContain("wind_speed_unit=ms");
  });

  it("rejects malformed source data rather than filling in readings", async () => {
    const http = vi.fn(
      async () =>
        new Response(JSON.stringify({ current: { time: "2026-10-31T09:00" } })),
    );
    await expect(
      new OpenMeteoAdapter(http).inspect({ lat: 54, lon: 32 }),
    ).rejects.toMatchObject({
      code: "SOURCE_UNAVAILABLE",
      statusCode: 503,
    });
  });

  it("rejects invalid source timestamps", async () => {
    const invalid = {
      ...sample,
      current: { ...sample.current, time: "2026-13-71T99:99" },
    };
    const http = vi.fn(async () => new Response(JSON.stringify(invalid)));
    await expect(
      new OpenMeteoAdapter(http).inspect({ lat: 54, lon: 32 }),
    ).rejects.toMatchObject({
      code: "SOURCE_UNAVAILABLE",
    });
  });

  it("reports provider outages as unavailable", async () => {
    const http = vi.fn(async () => new Response("", { status: 503 }));
    await expect(
      new OpenMeteoAdapter(http).inspect({ lat: 54, lon: 32 }),
    ).rejects.toMatchObject({
      code: "SOURCE_UNAVAILABLE",
    });
  });
});
