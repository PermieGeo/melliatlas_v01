// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { DistrictCacheRepository } from "../src/modules/sources/districtCacheRepository.js";
import {
  advanceDistrictCache,
  districtFilterHash,
  type DistrictCacheEntry,
} from "../src/modules/sources/districtCacheState.js";

let rootPool: Pool;
let pool: Pool;
let schema: string;
const now = new Date("2026-11-02T10:00:00.000Z");
const hash = districtFilterHash(55, 123, { sortColumn: "datePublishing" });

describe("district cache migrations and completed coverage", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    schema = `district_cache_${randomBytes(6).toString("hex")}`;
    rootPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await rootPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    for (const name of [
      "001_source_core.sql",
      "011_district_cache_state.sql",
      "012_district_cache_leases.sql",
    ]) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    }
    // The production schema defines this column in migration 002.
    await pool.query(
      "ALTER TABLE source_catalog ADD COLUMN registry_revision BIGINT NOT NULL DEFAULT 1",
    );
    await pool.query(
      "INSERT INTO source_catalog(id,name,kind,lifecycle,url) VALUES ('treatment-feed','Test','treatment','configured','https://example.org')",
    );
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (rootPool) {
      await rootPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rootPool.end();
    }
  });

  it("keeps partial coverage incomplete and rejects duplicate status rows", async () => {
    const repository = new DistrictCacheRepository(pool, () => now);
    await pool.query(
      `INSERT INTO source_district_cache
      (source_id,source_revision,district_provider_id,filter_hash,state)
      VALUES('treatment-feed','1',123,$1,'running')`,
      [hash],
    );
    await expect(
      pool.query(
        `INSERT INTO source_district_cache
      (source_id,source_revision,district_provider_id,filter_hash,state)
      VALUES('treatment-feed','1',123,$1,'running')`,
        [hash],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    expect(await repository.list()).toMatchObject([
      { coverage: "partial", nextPage: 0 },
    ]);
  });

  it("only marks a committed final page fresh and invalidates an older source revision", async () => {
    const repository = new DistrictCacheRepository(pool, () => now);
    const key: DistrictCacheEntry = (
      await repository.list()
    )[0] as DistrictCacheEntry;
    const claim = await repository.claim(key);
    expect(claim).not.toBeNull();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await repository.recordPage(
        client,
        advanceDistrictCache(claim!.entry, 0, 0, 0, now),
        claim!.leaseToken,
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    expect(await repository.list()).toMatchObject([
      { coverage: "fresh", recordsReceived: 0 },
    ]);
    await pool.query(
      "UPDATE source_catalog SET registry_revision=2 WHERE id='treatment-feed'",
    );
    expect(await repository.list()).toMatchObject([{ coverage: "stale" }]);
  });
  it("coalesces concurrent claims, refuses a fresh repeat, and permits a forced refresh", async () => {
    const repository = new DistrictCacheRepository(pool, () => now);
    const key = {
      sourceId: "treatment-feed",
      revision: "2",
      districtId: 456,
      filterHash: districtFilterHash(55, 456, {}),
    };
    const [first, second] = await Promise.all([
      repository.claim(key),
      repository.claim(key),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    const winner = first ?? second;
    expect(winner).not.toBeNull();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await repository.recordPage(
        client,
        advanceDistrictCache(winner!.entry, 0, 0, 0, now),
        winner!.leaseToken,
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    expect(await repository.claim(key)).toBeNull();
    const forced = await repository.claim(key, true);
    expect(forced?.entry).toMatchObject({
      state: "running",
      pagesFetched: 0,
      completedAt: now.toISOString(),
    });
    expect(await repository.claim(key, true)).toBeNull();
    expect(
      (await repository.list()).find((row) => row.districtId === 456),
    ).toMatchObject({ coverage: "stale", state: "running" });
    expect(
      await repository.fail(key, forced!.leaseToken, "PROVIDER_TIMEOUT"),
    ).toBe(true);
    expect(
      await repository.fail(key, forced!.leaseToken, "PROVIDER_TIMEOUT"),
    ).toBe(false);
    expect(
      (await repository.list()).find((row) => row.districtId === 456),
    ).toMatchObject({
      coverage: "stale",
      state: "failed",
      lastErrorCode: "PROVIDER_TIMEOUT",
    });
    await expect(
      repository.fail(key, forced!.leaseToken, "<raw provider response>"),
    ).rejects.toThrow("Invalid sanitized district error code");
  });

  it("cannot claim a stale configuration revision or publish rolled-back progress", async () => {
    const repository = new DistrictCacheRepository(pool, () => now);
    const key = {
      sourceId: "treatment-feed",
      revision: "2",
      districtId: 654,
      filterHash: districtFilterHash(55, 654, {}),
    };
    await expect(repository.claim({ ...key, revision: "1" })).rejects.toThrow(
      "District source revision is not configured",
    );
    const claim = await repository.claim(key);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await repository.recordPage(
        client,
        advanceDistrictCache(claim!.entry, 0, 0, 0, now),
        claim!.leaseToken,
      );
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    expect(
      (await repository.list()).find((row) => row.districtId === 654),
    ).toMatchObject({ state: "running", coverage: "partial", pagesFetched: 0 });
    expect(await repository.fail(key, claim!.leaseToken, "PROVIDER_503")).toBe(
      true,
    );
    expect(
      (await repository.list()).find((row) => row.districtId === 654),
    ).toMatchObject({ state: "failed", coverage: "partial" });
  });

  it("recovers abandoned partial progress and rejects a superseded worker", async () => {
    let clock = new Date(now.getTime() + 1_000);
    const repository = new DistrictCacheRepository(pool, () => clock);
    const key = {
      sourceId: "treatment-feed",
      revision: "2",
      districtId: 789,
      filterHash: districtFilterHash(55, 789, {}),
    };
    const initial = await repository.claim(key);
    expect(initial).not.toBeNull();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await repository.recordPage(
        client,
        advanceDistrictCache(initial!.entry, 1, 10, 8, clock),
        initial!.leaseToken,
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    clock = new Date(clock.getTime() + 6 * 60_000);
    const recovered = await repository.claim(key);
    expect(recovered?.entry).toMatchObject({
      nextPage: 1,
      pagesFetched: 1,
      recordsReceived: 10,
      recordsStored: 8,
    });
    expect(recovered?.leaseToken).not.toBe(initial?.leaseToken);
    const staleClient = await pool.connect();
    try {
      await staleClient.query("BEGIN");
      await expect(
        repository.recordPage(
          staleClient,
          advanceDistrictCache(recovered!.entry, 0, 2, 2, clock),
          initial!.leaseToken,
        ),
      ).rejects.toThrow("District job changed");
      await staleClient.query("ROLLBACK");
    } finally {
      staleClient.release();
    }
    const currentClient = await pool.connect();
    try {
      await currentClient.query("BEGIN");
      await repository.recordPage(
        currentClient,
        advanceDistrictCache(recovered!.entry, 0, 2, 2, clock),
        recovered!.leaseToken,
      );
      await currentClient.query("COMMIT");
    } finally {
      currentClient.release();
    }
    expect(
      (await repository.list()).find((row) => row.districtId === 789),
    ).toMatchObject({
      coverage: "fresh",
      recordsReceived: 12,
      recordsStored: 10,
    });
  });
});
