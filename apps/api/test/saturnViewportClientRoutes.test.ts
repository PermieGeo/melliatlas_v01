// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, type ApiServices } from "../src/app.js";

function setup() {
  const refreshDistricts = vi.fn(async (region: string) => ({
    regionCode: region,
    enabled: true,
    districts: [],
    retrievedAt: null,
  }));
  const fetchNext = vi.fn(async () => ({ enabled: true, progress: null }));
  const history = vi.fn(async () => ({ entries: [] }));
  const requestLog = vi.fn(async () => ({ entries: [] }));
  const storedFields = vi.fn(async () => ({ centers: [] }));
  const service: ApiServices = {
    inspectLocation: async () => {
      throw new Error("unused");
    },
    listSources: async () => [],
    checkReadiness: async () => true,
    viewportCollection: {
      status: vi.fn(async () => ({ enabled: true, progress: null })),
      fetchNext,
      refreshDistricts,
      history,
      requestLog,
      storedFields,
    },
    providerConfiguration: {
      get: async () => {
        throw new Error("unused");
      },
      update: async () => {
        throw new Error("unused");
      },
    },
  };
  return {
    app: createApp(service),
    refreshDistricts,
    fetchNext,
    history,
    requestLog,
    storedFields,
  };
}

it("keeps manual refresh and ingestion behind the operator boundary", async () => {
  const { app, refreshDistricts, fetchNext } = setup();
  const region = { regionCode: "55" };
  expect(
    (
      await request(app)
        .post("/api/v1/operator/provider/viewport/districts/refresh")
        .set("Origin", "http://127.0.0.1:5173")
        .send(region)
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post("/api/v1/operator/provider/viewport/districts/refresh")
        .set("Origin", "http://127.0.0.1:5174")
        .send(region)
    ).status,
  ).toBe(200);
  expect(refreshDistricts).toHaveBeenCalledWith("55", "admin");
  expect(fetchNext).not.toHaveBeenCalled();
});

it("keeps cached history restricted to operator access", async () => {
  const { app, history } = setup();
  expect(
    (
      await request(app)
        .get("/api/v1/operator/provider/viewport/history")
        .set("Origin", "http://127.0.0.1:5174")
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get("/api/v1/operator/provider/viewport/history")
        .set("Origin", "https://other.example")
    ).status,
  ).toBe(403);
  expect(history).toHaveBeenCalledTimes(1);
});

it("keeps request journal and saved index fields private to the operator", async () => {
  const { app, requestLog, storedFields } = setup();
  const hash = "a".repeat(64);
  expect(
    (
      await request(app)
        .get("/api/v1/operator/provider/viewport/requests")
        .set("Origin", "http://127.0.0.1:5174")
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get(`/api/v1/operator/provider/viewport/fields?hash=${hash}`)
        .set("Origin", "http://127.0.0.1:5174")
    ).status,
  ).toBe(200);
  expect(storedFields).toHaveBeenCalledWith(hash);
  expect(requestLog).toHaveBeenCalledTimes(1);
  expect(
    (
      await request(app)
        .get("/api/v1/operator/provider/viewport/requests")
        .set("Origin", "http://127.0.0.1:5173")
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .get("/api/v1/operator/provider/viewport/fields?hash=bad")
        .set("Origin", "http://127.0.0.1:5174")
    ).status,
  ).toBe(400);
});
