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
    const initial = (await repository.list())[0] as DistrictCacheEntry;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await repository.recordPage(
        client,
        advanceDistrictCache(initial, 0, 0, 0, now),
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
});
