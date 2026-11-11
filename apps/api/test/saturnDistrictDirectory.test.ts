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
  const query = vi.fn(async (sql: string, args?: unknown[]) => {
    if (sql.includes("FROM source_saturn_regions")) {
      return {
        rows:
          args?.[0] === "55"
            ? [{ subject_code: "55", display_name: "Smolensk" }]
            : [],
      };
    }
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
  it("rejects unregistered regions without contacting the provider", async () => {
    const { service, fetch } = setup();
    await expect(service.refresh("77", "web")).rejects.toMatchObject({
      code: "REGION_NOT_REGISTERED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores different provider directories under independent registered region keys", async () => {
    const catalogs = new Map<string, typeof districts>();
    const query = vi.fn(async (sql: string, args?: unknown[]) => {
      if (sql.includes("FROM source_saturn_regions")) {
        const code = args?.[0];
        return {
          rows: code
            ? ["55", "77"].includes(String(code))
              ? [{ subject_code: code }]
              : []
            : [
                { subject_code: "55", display_name: "Region A" },
                { subject_code: "77", display_name: "Region B" },
              ],
        };
      }
      if (sql.includes("FROM source_saturn_district_catalog")) {
        const catalog = catalogs.get(String(args?.[1]));
        return {
          rows: catalog
            ? [{ catalog, retrieved_at: new Date("2026-11-07T00:00:00Z") }]
            : [],
        };
      }
      if (sql.includes("FROM source_catalog"))
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
      if (sql.includes("INSERT INTO source_saturn_district_catalog")) {
        catalogs.set(
          String(args?.[2]),
          JSON.parse(String(args?.[3])) as typeof districts,
        );
      }
      return { rows: [] };
    });
    const fetch = vi.fn(async (_source: unknown, request: { url: string }) => ({
      bytes: Buffer.from(
        JSON.stringify([
          request.url.endsWith("/55") ? districts[0] : districts[1],
        ]),
      ),
      contentType: "application/json",
      canonicalUrl: request.url,
    }));
    const service = new SaturnDistrictDirectory(
      { query } as unknown as Pool,
      true,
      {
        fetcher: { fetch } as unknown as RestrictedSourceFetcher,
        gate: { reserve: vi.fn(async () => true) },
        journal: {
          start: vi.fn(async () => "1"),
          finish: vi.fn(async () => {}),
        },
      },
    );
    expect((await service.regions()).regions).toHaveLength(2);
    await service.refresh("55", "admin");
    await service.refresh("77", "admin");
    expect((await service.list("55")).districts.map((item) => item.id)).toEqual(
      [1477],
    );
    expect((await service.list("77")).districts.map((item) => item.id)).toEqual(
      [2670],
    );
    expect(await service.includes("77", 1477)).toBe(false);
    expect(fetch.mock.calls.map((call) => call[1].url)).toEqual([
      "https://bee-saturn.ru/backend/beemaster/district/55",
      "https://bee-saturn.ru/backend/beemaster/district/77",
    ]);
  });
  it("does not contact the provider during cached inspection", async () => {
    const { service, fetch, gate } = setup();
    expect((await service.list("55")).districts).toEqual([]);
    expect(await service.includes("55", 2670)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(gate.reserve).not.toHaveBeenCalled();
  });

  it("refreshes all observed districts once and makes the result durable", async () => {
    const { service, fetch, journal, query } = setup();
    expect((await service.refresh("55", "web")).districts).toHaveLength(2);
    expect((await service.list("55")).districts.map((item) => item.id)).toEqual(
      [1477, 2670],
    );
    expect(await service.includes("55", 2670)).toBe(true);
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
    await expect(disabled.service.refresh("55", "web")).rejects.toMatchObject({
      code: "SATURN_VIEWPORT_DISABLED",
    });
    expect(disabled.fetch).not.toHaveBeenCalled();
    const throttled = setup();
    throttled.gate.reserve.mockResolvedValueOnce(false);
    await expect(throttled.service.refresh("55", "web")).rejects.toMatchObject({
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
    await expect(service.refresh("55", "admin")).rejects.toMatchObject({
      code: "DISTRICT_DIRECTORY_FAILED",
    });
    expect((await service.list("55")).districts).toHaveLength(0);
    expect(journal.finish).toHaveBeenCalledWith(
      "1",
      "failed",
      0,
      "DISTRICT_DIRECTORY_FAILED",
    );
  });
});
