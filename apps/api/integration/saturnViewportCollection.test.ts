// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { SaturnViewportCollectionService } from "../src/modules/sources/saturnViewportCollection.js";
import type { RestrictedSourceFetcher } from "../src/modules/sources/httpFetcher.js";
import type { ViewportCollectionSelection } from "@melliatlas/contracts";

let mainPool: Pool;
let pool: Pool;
let schema: string;

const selection: ViewportCollectionSelection = {
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
const page = (number: number, ids: number[]): Record<string, unknown> => ({
  content: ids.map((id) => ({
    id,
    planId: 77777,
    name: "FICTIONAL",
    centerX: 32.8,
    centerY: 55.08,
  })),
  pageable: { pageNumber: number, pageSize: 10 },
  totalElements: 22,
  totalPages: 3,
  number,
  size: 10,
  numberOfElements: ids.length,
  first: number === 0,
  last: number === 2,
  empty: false,
});

/** Verify live service orchestration with a fake transport but real disposable PostGIS tables. */
describe("Saturn viewport live collection persistence", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    schema = `viewport_live_${randomBytes(6).toString("hex")}`;
    mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await mainPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    for (const name of [
      "001_source_core.sql",
      "002_source_access_registry.sql",
      "003_saturn_api_configuration.sql",
      "014_saturn_viewport_index.sql",
      "015_saturn_directory_and_request_log.sql",
    ]) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    }
    await pool.query(
      `INSERT INTO source_catalog (id,name,kind,lifecycle,url,api_request_config)
       VALUES ('treatment-feed','Fixture Saturn','treatment','configured',
       'https://bee-saturn.ru/backend/beemaster/planapplybees',
       '{"endpoint":"https://bee-saturn.ru/backend/beemaster/planapplybees"}'::jsonb)`,
    );
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (mainPool) {
      await mainPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await mainPool.end();
    }
  });

  it("persists an explicitly fetched district directory across restarts without automatic source calls", async () => {
    const districts = [
      { id: 1477, name: "Fixture Yartsevo", latitude: 55.06, longitude: 32.68 },
      { id: 2670, name: "Fixture Smolensk", latitude: 54.78, longitude: 32.05 },
    ];
    const fetch = vi.fn(async () => ({
      bytes: Buffer.from(JSON.stringify(districts)),
      canonicalUrl: "https://bee-saturn.ru/backend/beemaster/district/55",
      contentType: "application/json",
    }));
    const enabled = new SaturnViewportCollectionService(pool, true, {
      fetcher: { fetch } as unknown as RestrictedSourceFetcher,
      gate: { reserve: vi.fn(async () => true) },
    });
    expect((await enabled.refreshDistricts("web")).districts).toHaveLength(2);
    const restarted = new SaturnViewportCollectionService(pool, false);
    expect(
      (await restarted.districts()).districts.map((item) => item.id),
    ).toEqual([1477, 2670]);
    expect(
      (await restarted.status({ ...selection, districtId: 2670 })).progress,
    ).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await restarted.requestLog()).entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "district_directory",
          initiator: "web",
          status: "succeeded",
          receivedCount: 2,
        }),
      ]),
    );
  });

  it("fetches real service pages, saves durable checkpoints, and resumes across service instances", async () => {
    const response0 = JSON.parse(
      await readFile(
        new URL(
          "../test/fixtures/saturn-yartsevo-viewport-response.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as unknown;
    let fetchCount = 0;
    const fetch = vi.fn(
      async (_source: unknown, request: { method: string; body?: string }) => {
        expect(request.method).toBe("POST");
        const query = JSON.parse(request.body ?? "null") as {
          pageNumber: number;
        };
        expect(query.pageNumber).toBe(fetchCount);
        const body =
          fetchCount === 0
            ? response0
            : fetchCount === 1
              ? page(
                  1,
                  Array.from({ length: 10 }, (_, i) => 7000000 + i),
                )
              : page(2, [7000010, 7000011]);
        fetchCount++;
        return {
          bytes: Buffer.from(JSON.stringify(body)),
          contentType: "application/json",
          canonicalUrl: "https://bee-saturn.ru/backend/beemaster/query",
        };
      },
    );
    const deps = {
      fetcher: { fetch } as unknown as RestrictedSourceFetcher,
      gate: { reserve: vi.fn(async () => true) },
    };
    const first = new SaturnViewportCollectionService(pool, true, deps);
    expect((await first.status(selection)).progress).toBeNull();
    expect((await first.fetchNext(selection)).progress).toMatchObject({
      nextPage: 1,
      pagesFetched: 1,
    });
    const resumed = new SaturnViewportCollectionService(pool, true, deps);
    const restored = await resumed.status(selection);
    expect(restored.progress).toMatchObject({ nextPage: 1 });
    expect(restored.cachedCenters).toHaveLength(10);
    expect((await resumed.fetchNext(selection)).progress).toMatchObject({
      nextPage: 2,
      pagesFetched: 2,
    });
    expect((await resumed.fetchNext(selection)).progress).toMatchObject({
      nextPage: null,
      state: "viewport_index_complete",
      entriesReceived: 22,
    });
    await resumed.fetchNext(selection);
    expect(fetch).toHaveBeenCalledTimes(3);
    const count = await pool.query<{ n: number }>(
      "SELECT COUNT(*)::integer AS n FROM source_viewport_index_features WHERE source_id='treatment-feed'",
    );
    expect(count.rows[0]?.n).toBe(22);
    const history = await resumed.history();
    const points = await resumed.districtPoints(1477);
    expect(points.totalKnown).toBe(22);
    expect(points.centers).toHaveLength(22);
    expect(
      (await resumed.storedFields(history.entries[0]!.requestHash)).centers,
    ).toHaveLength(22);
    const log = await resumed.requestLog();
    const viewportAttempts = log.entries.filter(
      (entry) => entry.action === "viewport_page",
    );
    expect(viewportAttempts.map((entry) => entry.status)).toEqual([
      "cache_hit",
      "succeeded",
      "succeeded",
      "succeeded",
    ]);
    expect(viewportAttempts.every((entry) => entry.initiator === "admin")).toBe(
      true,
    );
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]).toMatchObject({
      districtId: 1477,
      pagesFetched: 3,
      entriesReceived: 22,
      totalPages: 3,
      state: "viewport_index_complete",
      fromDate: selection.fromDate,
      toDate: selection.toDate,
    });
    expect(
      history.entries[0]?.recentPages.map((p) => [p.pageNumber, p.recordCount]),
    ).toEqual([
      [2, 2],
      [1, 10],
      [0, 10],
    ]);
    expect(history.entries[0]?.updatedAt).toMatch(/^\d{4}-/);
    const districtCache = await pool.query<{ n: number }>(
      "SELECT COUNT(*)::integer AS n FROM pg_tables WHERE schemaname=$1 AND tablename='source_district_cache'",
      [schema],
    );
    expect(districtCache.rows[0]?.n).toBe(0);
  });
});
