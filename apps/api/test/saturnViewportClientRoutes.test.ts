// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, type ApiServices } from "../src/app.js";
import type { ViewportCollectionSelection } from "@melliatlas/contracts";

const origin = "http://127.0.0.1:5173";
const selection: ViewportCollectionSelection = {
  districtId: 1477,
  bbox: { west: 32.41, south: 54.93, east: 33.03, north: 55.21 },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
};

function setup(enabled = true) {
  const status = vi.fn(async () => ({ enabled, progress: null }));
  const fetchNext = vi.fn(async () => ({ enabled, progress: null }));
  const history = vi.fn(async () => ({ entries: [] }));
  const services: ApiServices = {
    inspectLocation: async () => {
      throw new Error("Unused weather service");
    },
    listSources: async () => [],
    checkReadiness: async () => true,
    viewportCollection: { status, fetchNext, history },
    providerConfiguration: {
      get: async () => {
        throw new Error("Unused provider settings");
      },
      update: async () => {
        throw new Error("Unused provider settings");
      },
    },
  };
  return { app: createApp(services), status, fetchNext, history };
}

/** Local client requests use their own bounded route and never call operator paths. */
describe("local beekeeper viewport collection boundary", () => {
  it("exposes cache status without fetching until an explicit next-page click", async () => {
    const { app, status, fetchNext } = setup();
    const read = await request(app)
      .post("/api/v1/map/saturn-viewport/status")
      .set("Origin", origin)
      .send(selection);
    expect(read.status).toBe(200);
    expect(status).toHaveBeenCalledWith(selection);
    expect(fetchNext).not.toHaveBeenCalled();
    const next = await request(app)
      .post("/api/v1/map/saturn-viewport/next")
      .set("Origin", origin)
      .send(selection);
    expect(next.status).toBe(200);
    expect(fetchNext).toHaveBeenCalledTimes(1);
  });

  it.each(["http://evil.example", "http://127.0.0.1:5174"])(
    "refuses requests from non-client origins: %s",
    async (invalidOrigin) => {
      const { app, fetchNext } = setup();
      const result = await request(app)
        .post("/api/v1/map/saturn-viewport/next")
        .set("Origin", invalidOrigin)
        .send(selection);
      expect(result.status).toBe(403);
      expect(result.body.error.code).toBe("LOCAL_VIEWPORT_ONLY");
      expect(fetchNext).not.toHaveBeenCalled();
    },
  );

  it("refuses missing Origin and invalid oversized or unsupported district selections", async () => {
    const { app, fetchNext } = setup();
    expect(
      (
        await request(app)
          .post("/api/v1/map/saturn-viewport/next")
          .send(selection)
      ).status,
    ).toBe(403);
    for (const input of [
      { ...selection, districtId: 2670 },
      { ...selection, bbox: { ...selection.bbox, east: 35 } },
      { ...selection, toDate: "2027-12-31" },
    ]) {
      const result = await request(app)
        .post("/api/v1/map/saturn-viewport/next")
        .set("Origin", origin)
        .send(input);
      expect(result.status).toBe(400);
      expect(result.body.error.code).toBe("INVALID_VIEWPORT_SELECTION");
    }
    expect(fetchNext).not.toHaveBeenCalled();
  });

  it("never silently enables collection without a wired backend service", async () => {
    const { app, fetchNext } = setup();
    const result = await request(app)
      .post("/api/v1/map/saturn-viewport/next")
      .set("Origin", origin)
      .send(selection);
    expect(result.status).toBe(200);
    expect(fetchNext).toHaveBeenCalledTimes(1);
    const unavailable = createApp({
      inspectLocation: async () => {
        throw new Error("Unused");
      },
      listSources: async () => [],
      checkReadiness: async () => true,
    });
    const denied = await request(unavailable)
      .post("/api/v1/map/saturn-viewport/next")
      .set("Origin", origin)
      .send(selection);
    expect(denied.status).toBe(503);
  });
});

describe("local operator cache history", () => {
  it("reads shared saved checkpoints without source fetching", async () => {
    const { app, history, fetchNext } = setup();
    const result = await request(app)
      .get("/api/v1/operator/provider/viewport/history")
      .set("Origin", "http://127.0.0.1:5174");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ entries: [] });
    expect(history).toHaveBeenCalledTimes(1);
    expect(fetchNext).not.toHaveBeenCalled();
    const blocked = await request(app)
      .get("/api/v1/operator/provider/viewport/history")
      .set("Origin", "https://other.example");
    expect(blocked.status).toBe(403);
  });
});
