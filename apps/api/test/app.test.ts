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

describe("local administrator configuration HTTP boundary", () => {
  const configuration = {
    providerName: "Example Provider",
    endpoint: "https://example.org/plans",
    request: {
      method: "POST" as const,
      regionParameter: "subject",
      regionCode: 55,
      parameters: {},
    },
    revision: "1",
    collectionEnabled: false as const,
  };
  const adminServices: ApiServices = {
    ...services,
    providerConfiguration: {
      get: async () => configuration,
      update: async (value) => ({
        ...configuration,
        endpoint: value.endpoint,
        revision: "2",
      }),
    },
  };

  it("opens settings and saves a revision without a bearer token", async () => {
    const app = createApp(adminServices);
    const loaded = await request(app).get("/api/v1/operator/provider");
    expect(loaded.status).toBe(200);
    expect(loaded.body).toEqual(configuration);
    expect(loaded.headers["cache-control"]).toBe("no-store");
    const changed = await request(app).put("/api/v1/operator/provider").send({
      providerName: "Updated Provider",
      endpoint: "https://example.org/new-plans",
      request: configuration.request,
      expectedRevision: "1",
    });
    expect(changed.status).toBe(200);
    expect(changed.body.endpoint).toBe("https://example.org/new-plans");
  });

  it("still validates settings and refuses a missing administrator service", async () => {
    const invalid = await request(createApp(adminServices))
      .put("/api/v1/operator/provider")
      .send({
        providerName: "Provider",
        endpoint: "https://example.org/plans",
        request: configuration.request,
        expectedRevision: "0",
      });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_PROVIDER_CONFIG");
    const unavailable = await request(createApp(services)).get(
      "/api/v1/operator/provider",
    );
    expect(unavailable.status).toBe(503);
  });
});

describe("local administrator treatment evidence HTTP boundaries", () => {
  let syncCount = 0;
  const treatmentFeed: NonNullable<ApiServices["treatmentFeed"]> = {
    status: async () => ({
      sourceConfigured: true,
      latestRun: null,
      pendingReview: 0,
      pendingWithGeometry: 0,
      verifiedWithGeometry: 0,
      missingGeometry: 0,
    }),
    syncOnePage: async () => {
      syncCount++;
      return {
        runId: "fixture",
        pageNumber: 0,
        received: 1,
        stored: 1,
        nextPage: 0,
      };
    },
    pending: async () => [],
    review: async () => {},
    published: async () => [
      {
        id: "structured",
        reviewStatus: "pending",
        geometry: {
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
    ],
    preview: async () => [
      {
        id: "preview",
        reviewStatus: "pending",
        geometry: {
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
    ],
  };

  it("keeps ingestion administrator-only and exposes source-attributed unreviewed map records publicly", async () => {
    const app = createApp({ ...services, treatmentFeed });
    const before = syncCount;
    const synced = await request(app).post("/api/v1/operator/provider/sync");
    expect(synced.status).toBe(200);
    expect(syncCount).toBe(before + 1);
    const preview = await request(app).get(
      "/api/v1/operator/notices/map-preview",
    );
    expect(preview.status).toBe(200);
    expect(preview.headers["cache-control"]).toBe("no-store");
    expect(preview.body.notices[0].reviewStatus).toBe("pending");
    const publicMap = await request(app).get("/api/v1/notices");
    expect(publicMap.status).toBe(200);
    expect(publicMap.body.notices).toMatchObject([
      { id: "structured", reviewStatus: "pending" },
    ]);
    expect(publicMap.headers["cache-control"]).toBe("no-store");
  });

  it("rejects cross-origin browser writes to local admin routes", async () => {
    const app = createApp({ ...services, treatmentFeed });
    const before = syncCount;
    const blocked = await request(app)
      .post("/api/v1/operator/provider/sync")
      .set("Origin", "https://attacker.example.org");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(syncCount).toBe(before);
    const publicUi = await request(app)
      .post("/api/v1/operator/provider/sync")
      .set("Origin", "http://localhost:5173");
    expect(publicUi.status).toBe(403);
    const local = await request(app)
      .post("/api/v1/operator/provider/sync")
      .set("Origin", "http://localhost:5174");
    expect(local.status).toBe(200);
  });

  it("keeps the discontinued permission route absent and exposes read-only status", async () => {
    const app = createApp({ ...services, treatmentFeed });
    expect(
      (await request(app).post("/api/v1/operator/provider/approve")).status,
    ).toBe(404);
    const response = await request(app).get("/api/v1/operator/provider/status");
    expect(response.status).toBe(200);
    expect(response.body.sourceConfigured).toBe(true);
  });

  it("rejects invalid public bbox without fetching or leaking pending observations", async () => {
    const app = createApp({ ...services, treatmentFeed });
    for (const bbox of ["0,0,0,1", "190,0,200,1", "x,0,2,3", "1,2,3,4,5"]) {
      const result = await request(app).get(`/api/v1/notices?bbox=${bbox}`);
      expect(result.status).toBe(400);
      expect(result.body.error.code).toBe("INVALID_BBOX");
    }
    expect(
      (await request(app).get("/api/v1/notices?bbox=30,53,35,56")).body.notices,
    ).toHaveLength(1);
  });
});

it("permits only the local administrator to start or inspect regional collection", async () => {
  let starts = 0;
  const status = { regionCode: 55, nextPage: 0, scan: null };
  const app = createApp({
    ...services,
    regionCollection: {
      status: async () => status,
      start: async () => {
        starts += 1;
        return status;
      },
      pause: async () => status,
    },
    providerConfiguration: {
      get: async () => {
        throw new Error("not used");
      },
      update: async () => {
        throw new Error("not used");
      },
    },
  });
  const publicOrigin = await request(app)
    .post("/api/v1/operator/provider/region-scan/start")
    .set("Origin", "http://localhost:5173");
  expect(publicOrigin.status).toBe(403);
  expect(starts).toBe(0);
  const admin = await request(app)
    .post("/api/v1/operator/provider/region-scan/start")
    .set("Origin", "http://localhost:5174");
  expect(admin.status).toBe(200);
  expect(starts).toBe(1);
  expect(
    await request(app)
      .get("/api/v1/operator/provider/region-scan")
      .set("Origin", "http://localhost:5174")
      .then((response) => response.body),
  ).toEqual(status);
});

it("district cache is operator-only and cannot refresh before the upstream contract is verified", async () => {
  const app = createApp({
    ...services,
    districtCache: { list: async () => [] },
    providerConfiguration: {
      get: async () => {
        throw new Error("not used");
      },
      update: async () => {
        throw new Error("not used");
      },
    },
  });
  const status = await request(app).get(
    "/api/v1/operator/provider/district-cache",
  );
  expect(status.status).toBe(200);
  expect(status.body).toEqual({
    ttlHours: 24,
    refreshEnabled: false,
    entries: [],
  });
  const noFetch = await request(app)
    .post("/api/v1/operator/provider/district-cache/refresh")
    .set("Origin", "http://localhost:5174")
    .send({ districtId: 123 });
  expect(noFetch.status).toBe(409);
  expect(noFetch.body.error.code).toBe("DISTRICT_CONTRACT_UNVERIFIED");
  const publicOrigin = await request(app)
    .post("/api/v1/operator/provider/district-cache/refresh")
    .set("Origin", "http://localhost:5173");
  expect(publicOrigin.status).toBe(403);
});

describe("operator-only viewport route", () => {
  const selection = {
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
  it("validates the explicit selection and never triggers a fetch from status", async () => {
    let fetched = 0;
    const app = createApp({
      ...services,
      providerConfiguration: {
        get: async () => {
          throw new Error("Unused");
        },
        update: async () => {
          throw new Error("Unused");
        },
      },
      viewportCollection: {
        status: async () => ({ enabled: true, progress: null }),
        fetchNext: async () => {
          fetched++;
          return { enabled: true, progress: null };
        },
      },
    });
    const invalid = await request(app)
      .post("/api/v1/operator/provider/viewport/next")
      .send({ ...selection, districtId: 2670 });
    expect(invalid.status).toBe(400);
    expect(fetched).toBe(0);
    const status = await request(app)
      .post("/api/v1/operator/provider/viewport/status")
      .send(selection);
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ enabled: true, progress: null });
    expect(fetched).toBe(0);
    const next = await request(app)
      .post("/api/v1/operator/provider/viewport/next")
      .send(selection);
    expect(next.status).toBe(200);
    expect(fetched).toBe(1);
  });
});
