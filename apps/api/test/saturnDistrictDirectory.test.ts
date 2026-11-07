// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { SaturnDistrictDirectory } from "../src/modules/sources/providers/saturn/saturnDistrictDirectory.js";
import type { RestrictedSourceFetcher } from "../src/modules/sources/httpFetcher.js";

const districts = [
  { id: 1477, name: "Yartsevo", latitude: 55.06, longitude: 32.68 },
  { id: 2670, name: "Smolensk", latitude: 54.78, longitude: 32.05 },
];
function setup(enabled = true) {
  let catalog: typeof districts | null = null;
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM source_saturn_district_catalog")) {
      return {
        rows: catalog
          ? [{ catalog, retrieved_at: new Date("2026-11-07T00:00:00.000Z") }]
          : [],
      };
    }
    if (sql.includes("FROM source_catalog")) {
      return {
        rows: [
          {
            name: "Fixture",
            registry_revision: "1",
            kind: "treatment",
            lifecycle: "configured",
          },
        ],
      };
    }
    if (sql.includes("INSERT INTO source_saturn_district_catalog")) {
      catalog = districts;
    }
    return { rows: [] };
  });
  const fetch = vi.fn(async () => ({
    bytes: Buffer.from(JSON.stringify(districts)),
    contentType: "application/json",
    canonicalUrl: "https://bee-saturn.ru/backend/beemaster/district/55",
  }));
  const gate = { reserve: vi.fn(async () => true) };
  const journal = {
    start: vi.fn(async () => "1"),
    finish: vi.fn(async () => {}),
  };
  const service = new SaturnDistrictDirectory(
    { query } as unknown as Pool,
    enabled,
    {
      gate,
      journal,
      fetcher: { fetch } as unknown as RestrictedSourceFetcher,
    },
  );
  return { service, query, fetch, gate, journal };
}

describe("explicit Saturn district directory collection", () => {
  it("does not contact the provider during cached inspection", async () => {
    const { service, fetch, gate } = setup();
    expect((await service.list()).districts).toEqual([]);
    expect(await service.includes(2670)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(gate.reserve).not.toHaveBeenCalled();
  });

  it("refreshes all observed districts once and makes the result durable", async () => {
    const { service, fetch, journal, query } = setup();
    expect((await service.refresh("web")).districts).toHaveLength(2);
    expect((await service.list()).districts.map((item) => item.id)).toEqual([
      1477, 2670,
    ]);
    expect(await service.includes(2670)).toBe(true);
    expect(fetch).toHaveBeenCalledWith(expect.anything(), {
      url: "https://bee-saturn.ru/backend/beemaster/district/55",
      method: "GET",
      requestProfile: "saturn-json",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("source_saturn_district_catalog"),
      expect.arrayContaining(["treatment-feed", "1"]),
    );
    expect(journal.finish).toHaveBeenCalledWith("1", "succeeded", 2);
  });

  it("enforces disabled mode and the shared source cooldown", async () => {
    const disabled = setup(false);
    await expect(disabled.service.refresh("web")).rejects.toMatchObject({
      code: "SATURN_VIEWPORT_DISABLED",
    });
    expect(disabled.fetch).not.toHaveBeenCalled();
    const throttled = setup();
    throttled.gate.reserve.mockResolvedValueOnce(false);
    await expect(throttled.service.refresh("web")).rejects.toMatchObject({
      code: "SOURCE_THROTTLED",
    });
    expect(throttled.journal.finish).toHaveBeenCalledWith(
      "1",
      "throttled",
      0,
      "SOURCE_THROTTLED",
    );
    expect(throttled.fetch).not.toHaveBeenCalled();
  });

  it("never replaces a valid catalog with malformed provider data", async () => {
    const { service, fetch, journal } = setup();
    fetch.mockResolvedValueOnce({
      bytes: Buffer.from(JSON.stringify([districts[0], districts[0]])),
      contentType: "application/json",
      canonicalUrl: "https://bee-saturn.ru/backend/beemaster/district/55",
    });
    await expect(service.refresh("admin")).rejects.toMatchObject({
      code: "DISTRICT_DIRECTORY_FAILED",
    });
    expect((await service.list()).districts).toHaveLength(0);
    expect(journal.finish).toHaveBeenCalledWith(
      "1",
      "failed",
      0,
      "DISTRICT_DIRECTORY_FAILED",
    );
  });
});
