// Feature IDs: WEATHER.POINT_FORECAST
import type { Coordinates, InspectionResponse } from "@melliatlas/contracts";
import { inspectionResponseSchema } from "@melliatlas/contracts";
import { z } from "zod";
import { UpstreamUnavailable } from "../../lib/errors.js";

const openMeteoSchema = z
  .object({
    current: z
      .object({
        time: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        temperature_2m: z.number().finite(),
        relative_humidity_2m: z.number().finite().min(0).max(100),
        wind_speed_10m: z.number().finite().nonnegative(),
        wind_direction_10m: z.number().finite().min(0).max(360),
        precipitation: z.number().finite().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

export type RemoteFetcher = typeof fetch;

export class OpenMeteoAdapter {
  constructor(
    private readonly http: RemoteFetcher = fetch,
    private readonly timeoutMs = 8000,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async inspect(point: Coordinates): Promise<InspectionResponse> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(point.lat));
    url.searchParams.set("longitude", String(point.lon));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation",
    );
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("timezone", "GMT");

    try {
      const response = await this.http(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new UpstreamUnavailable("Open-Meteo");
      }

      const parsed = openMeteoSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new UpstreamUnavailable("Open-Meteo");
      }

      const current = parsed.data.current;
      const observedAt = new Date(`${current.time}Z`);
      if (!Number.isFinite(observedAt.getTime())) {
        throw new UpstreamUnavailable("Open-Meteo");
      }

      return inspectionResponseSchema.parse({
        point,
        weather: {
          temperatureC: current.temperature_2m,
          relativeHumidityPct: current.relative_humidity_2m,
          windSpeedMs: current.wind_speed_10m,
          windDirectionDeg: current.wind_direction_10m,
          precipitationMm: current.precipitation,
        },
        provenance: {
          sourceId: "open-meteo",
          sourceName: "Open-Meteo forecast",
          sourceUrl: url.toString(),
          retrievedAt: this.clock().toISOString(),
          observedAt: observedAt.toISOString(),
          nature: "forecast_model",
        },
      });
    } catch (error) {
      if (error instanceof UpstreamUnavailable) {
        throw error;
      }
      throw new UpstreamUnavailable("Open-Meteo", { cause: error });
    }
  }
}
