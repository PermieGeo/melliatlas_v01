import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, type ApiServices } from "../src/app.js";
import { UpstreamUnavailable } from "../src/lib/errors.js";

const services: ApiServices = {
  inspectLocation: async (point) => ({
    point,
    weather: {
      temperatureC: 12,
      relativeHumidityPct: 80,
      windSpeedMs: 2.4,
      windDirectionDeg: 90,
      precipitationMm: 0,
    },
    provenance: {
      sourceId: "test-fixture",
      sourceName: "Synthetic test fixture",
      sourceUrl: "https://example.invalid/test",
      retrievedAt: "2026-10-31T09:00:00.000Z",
      observedAt: "2026-10-31T08:00:00.000Z",
      nature: "forecast_model",
    },
  }),
  listSources: async () => [],
  checkReadiness: async () => true,
};

describe("MelliAtlas public API", () => {
  it("returns an attributed inspection result and a request ID", async () => {
    const response = await request(createApp(services)).get(
      "/api/v1/locations/inspect?lat=54.78&lon=32.05",
    );
    expect(response.status).toBe(200);
    expect(response.body.point).toEqual({ lat: 54.78, lon: 32.05 });
    expect(response.body.provenance.sourceId).toBe("test-fixture");
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns an empty source catalog without claiming a successful ingest", async () => {
    const response = await request(createApp(services)).get("/api/v1/sources");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sources: [] });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("fails readiness when storage is unavailable", async () => {
    const response = await request(
      createApp({ ...services, checkReadiness: async () => false }),
    ).get("/health/ready");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
  });

  it("does not disclose internal failures when listing sources", async () => {
    const response = await request(
      createApp({
        ...services,
        listSources: async () => {
          throw new Error("private database connection string");
        },
      }),
    ).get("/api/v1/sources");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain(
      "private database connection string",
    );
  });

  it("reports unknown API routes as typed 404 errors", async () => {
    const response = await request(createApp(services)).get("/api/v1/unknown");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.requestId).toEqual(
      response.headers["x-request-id"],
    );
  });

  it.each([
    "/api/v1/locations/inspect?lat=hello&lon=32",
    "/api/v1/locations/inspect?lat=91&lon=32",
    "/api/v1/locations/inspect?lat=54&lon=32&unknown=1",
  ])("rejects invalid location query: %s", async (path) => {
    const response = await request(createApp(services)).get(path);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_COORDINATES");
  });

  it("does not invent a result when a source fails", async () => {
    const failing = createApp({
      ...services,
      inspectLocation: async () => {
        throw new Error("provider failed");
      },
    });
    const response = await request(failing).get(
      "/api/v1/locations/inspect?lat=54&lon=32",
    );
    expect(response.status).toBe(500);
    expect(response.body.weather).toBeUndefined();
  });

  it("returns a typed unavailable error without exposing provider internals", async () => {
    const app = createApp({
      ...services,
      inspectLocation: async () => {
        throw new UpstreamUnavailable("Open-Meteo");
      },
    });
    const response = await request(app).get(
      "/api/v1/locations/inspect?lat=54&lon=32",
    );
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("SOURCE_UNAVAILABLE");
    expect(response.body.error.requestId).toEqual(
      response.headers["x-request-id"],
    );
    expect(response.body.weather).toBeUndefined();
  });
});
