// Feature IDs: SOURCES.CATALOG, NOTICES.MAP_OVERLAY
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import request from "supertest";
import { createApp, type ApiServices } from "../src/app.js";
import { createTerritoryDirectory } from "../src/modules/sources/territoryDirectory.js";

function setup() {
  const query = vi.fn(async (statement: string, parameters?: unknown[]) => {
    if (statement.includes("FROM territory_regions ORDER BY")) {
      return { rows: [{ id: "ru-smolensk", name: "Example region" }] };
    }
    if (statement.includes("FROM territory_regions AS region")) {
      return {
        rows:
          parameters?.[0] === "ru-smolensk"
            ? [{ provider_key: "saturn", external_code: "55" }]
            : [],
      };
    }
    throw new Error("Unexpected query");
  });
  const readCachedDistricts = vi.fn(async () => [
    { id: 22, name: "Example district", latitude: 54, longitude: 32 },
  ]);
  const services: ApiServices = {
    inspectLocation: async () => {
      throw new Error("Unused");
    },
    listSources: async () => [],
    checkReadiness: async () => true,
    territories: createTerritoryDirectory(
      { query } as unknown as Pick<Pool, "query">,
      readCachedDistricts,
    ),
    viewportCollection: {
      status: vi.fn(async () => ({ enabled: false, progress: null })),
      fetchNext: vi.fn(async () => ({ enabled: false, progress: null })),
    },
  };
  return {
    app: createApp(services),
    query,
    readCachedDistricts,
    fetchNext: services.viewportCollection!.fetchNext,
  };
}

describe("local territory navigation versus operator collection", () => {
  it("reads internal region IDs and maps saved district centers without upstream requests", async () => {
    const { app, readCachedDistricts, fetchNext } = setup();
    const regions = await request(app).get("/api/v1/territories/regions");
    expect(regions.status).toBe(200);
    expect(regions.body).toEqual({
      regions: [{ id: "ru-smolensk", name: "Example region" }],
    });
    const districts = await request(app).get(
      "/api/v1/territories/districts?regionId=ru-smolensk",
    );
    expect(districts.status).toBe(200);
    expect(districts.body).toEqual({
      regionId: "ru-smolensk",
      districts: [
        { id: "22", name: "Example district", center: { lat: 54, lon: 32 } },
      ],
    });
    expect(readCachedDistricts).toHaveBeenCalledWith("saturn", "55");
    expect(fetchNext).not.toHaveBeenCalled();
  });

  it("returns an empty district list for a registered region without cached data", async () => {
    const { app, readCachedDistricts } = setup();
    readCachedDistricts.mockResolvedValueOnce([]);
    const response = await request(app).get(
      "/api/v1/territories/districts?regionId=ru-smolensk",
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ regionId: "ru-smolensk", districts: [] });
  });

  it("distinguishes malformed territory IDs from unknown opaque IDs", async () => {
    const { app, readCachedDistricts } = setup();
    for (const query of [
      "regionId=bad%20id",
      "regionId=ru-smolensk&regionId=ru-smolensk",
      "regionId=",
    ]) {
      const response = await request(app).get(
        `/api/v1/territories/districts?${query}`,
      );
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_TERRITORY_REGION");
    }
    for (const regionId of ["abc", "99"]) {
      const response = await request(app).get(
        `/api/v1/territories/districts?regionId=${regionId}`,
      );
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("TERRITORY_REGION_NOT_FOUND");
    }
    expect(readCachedDistricts).not.toHaveBeenCalled();
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
