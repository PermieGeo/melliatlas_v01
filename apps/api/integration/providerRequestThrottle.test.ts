// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { ProviderRequestThrottle } from "../src/modules/sources/providerRequestThrottle.js";

let rootPool: Pool;
let pool: Pool;
let schema: string;

const sourceA = "throttle-source-a";
const sourceB = "throttle-source-b";

describe("source-wide provider request throttle", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    schema = `source_throttle_${randomBytes(6).toString("hex")}`;
    rootPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await rootPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    for (const filename of [
      "001_source_core.sql",
      "013_source_request_throttle.sql",
    ]) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${filename}`, import.meta.url),
          "utf8",
        ),
      );
    }
    await pool.query(
      `INSERT INTO source_catalog(id,name,kind,lifecycle,url)
       VALUES ($1,'Fixture A','treatment','configured','https://example.org/a'),
              ($2,'Fixture B','treatment','configured','https://example.org/b')`,
      [sourceA, sourceB],
    );
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (rootPool) {
      await rootPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rootPool.end();
    }
  });

  it("reserves exactly one slot across concurrent instances", async () => {
    const first = new ProviderRequestThrottle(pool);
    const second = new ProviderRequestThrottle(pool);
    const attempts = await Promise.all([
      first.reserve(sourceA),
      second.reserve(sourceA),
      first.reserve(sourceA),
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(await second.reserve(sourceA)).toBe(false);
    expect(await first.reserve(sourceB)).toBe(true);
  });

  it("preserves the delay across new instances and recovers after expiry", async () => {
    const restarted = new ProviderRequestThrottle(pool);
    expect(await restarted.reserve(sourceA)).toBe(false);
    await pool.query(
      `UPDATE source_request_throttle SET next_allowed_at=clock_timestamp()-interval '1 second'
       WHERE source_id=$1`,
      [sourceA],
    );
    expect(await restarted.reserve(sourceA)).toBe(true);
    const slot = await pool.query<{ remaining_ms: number }>(
      `SELECT EXTRACT(EPOCH FROM (next_allowed_at - clock_timestamp())) * 1000 AS remaining_ms
       FROM source_request_throttle WHERE source_id=$1`,
      [sourceA],
    );
    expect(Number(slot.rows[0].remaining_ms)).toBeGreaterThan(18_000);
    expect(Number(slot.rows[0].remaining_ms)).toBeLessThanOrEqual(20_000);
    expect(await new ProviderRequestThrottle(pool).reserve(sourceA)).toBe(
      false,
    );
  });

  it("does not consume a slot for an unknown catalog source", async () => {
    await expect(
      new ProviderRequestThrottle(pool).reserve("missing-source"),
    ).rejects.toMatchObject({ code: "23503" });
    const result = await pool.query(
      "SELECT count(*)::integer AS count FROM source_request_throttle WHERE source_id=$1",
      ["missing-source"],
    );
    expect(result.rows[0].count).toBe(0);
  });
});
