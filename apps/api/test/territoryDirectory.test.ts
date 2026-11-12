// Feature IDs: SOURCES.CATALOG, NOTICES.MAP_OVERLAY
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, type ApiServices } from "../src/app.js";
import { createTerritoryDirectory } from "../src/modules/sources/territoryDirectory.js";

function setup() {
  const source = {
    regions: vi.fn(async () => ({
      regions: [{ code: "55", name: "Example region" }],
    })),
    districts: vi.fn(async () => ({
      districts: [
        { id: 22, name: "Example district", latitude: 54, longitude: 32 },
      ],
    })),
  };
  const services: ApiServices = {
    inspectLocation: async () => {
      throw new Error("Unused");
    },
    listSources: async () => [],
    checkReadiness: async () => true,
    territories: createTerritoryDirectory(source),
    viewportCollection: {
      status: vi.fn(async () => ({ enabled: false, progress: null })),
      fetchNext: vi.fn(async () => ({ enabled: false, progress: null })),
    },
  };
  return {
    app: createApp(services),
    source,
    fetchNext: services.viewportCollection!.fetchNext,
  };
}

describe("public navigation versus operator collection", () => {
  it("reads provider-neutral DTOs without fetching source data", async () => {
    const { app, source, fetchNext } = setup();
    const regions = await request(app).get("/api/v1/territories/regions");
    expect(regions.status).toBe(200);
    expect(regions.body).toEqual({
      regions: [{ id: "55", name: "Example region" }],
    });
    const districts = await request(app).get(
      "/api/v1/territories/districts?regionId=55",
    );
    expect(districts.status).toBe(200);
    expect(districts.body).toEqual({
      regionId: "55",
      districts: [
        {
          id: "22",
          name: "Example district",
          center: { lat: 54, lon: 32 },
        },
      ],
    });
    expect(source.districts).toHaveBeenCalledWith("55");
    expect(fetchNext).not.toHaveBeenCalled();
  });

  it("distinguishes malformed territory IDs from unknown opaque IDs", async () => {
    const { app, source } = setup();
    for (const query of [
      "regionId=bad%20id",
      "regionId=55&regionId=55",
      "regionId=",
    ]) {
      const invalid = await request(app).get(
        `/api/v1/territories/districts?${query}`,
      );
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe("INVALID_TERRITORY_REGION");
    }

    for (const regionId of ["abc", "99"]) {
      const unknown = await request(app).get(
        `/api/v1/territories/districts?regionId=${regionId}`,
      );
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe("TERRITORY_REGION_NOT_FOUND");
    }
    expect(source.districts).not.toHaveBeenCalled();
  });

  it("provides no public provider refresh or collection route", async () => {
    const { app, fetchNext } = setup();
    for (const action of ["next", "status", "districts/refresh"]) {
      const response = await request(app)
        .post(`/api/v1/map/saturn-viewport/${action}`)
        .send({});
      expect(response.status).toBe(404);
    }
    expect(fetchNext).not.toHaveBeenCalled();
  });
});
