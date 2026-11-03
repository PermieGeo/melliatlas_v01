import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { seedDemoTreatments } from "../src/modules/sources/demoSeed.js";
import { listStoredMapTreatments } from "../src/modules/sources/treatmentMapProjection.js";

let rootPool: Pool;
let pool: Pool;
let schema: string;

/** Seed against a disposable schema rather than changing a developer's demo database. */
describe("synthetic seed persistence (PostGIS)", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    schema = `demo_seed_${randomBytes(6).toString("hex")}`;
    rootPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await rootPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    const migrations = (
      await readdir(new URL("../migrations/", import.meta.url))
    )
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (rootPool) {
      await rootPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rootPool.end();
    }
  });

  it("seeds through production tables and preserves decisions on repeated calls", async () => {
    expect(await seedDemoTreatments(pool)).toEqual({
      inserted: true,
      observations: 12,
    });
    const notices = await listStoredMapTreatments(
      pool,
      "treatment-feed",
      false,
      [31.7, 54.6, 32.5, 55],
    );
    expect(notices).toHaveLength(10);
    expect(notices.every((row) => row.sourceName.includes("SYNTHETIC"))).toBe(
      true,
    );
    expect(notices.some((row) => row.id.endsWith("000005"))).toBe(false);
    expect(notices.some((row) => row.id.endsWith("000011"))).toBe(false);
    await pool.query(
      "UPDATE source_observations SET review_status='verified' WHERE id=$1",
      ["d0000000-0000-4000-8000-000000000002"],
    );
    await pool.query(
      `INSERT INTO source_observation_reviews(observation_id,reviewer,decision,evidence_note)
       VALUES($1,'DEMO test reviewer','verified',$2)`,
      [
        "d0000000-0000-4000-8000-000000000002",
        "SYNTHETIC DEMO ONLY: manual scenario to prove reseeding preserves reviews.",
      ],
    );
    expect(await seedDemoTreatments(pool)).toEqual({
      inserted: false,
      observations: 12,
    });
    const reviewed = await pool.query<{ review_status: string }>(
      "SELECT review_status FROM source_observations WHERE id=$1",
      ["d0000000-0000-4000-8000-000000000002"],
    );
    expect(reviewed.rows[0]?.review_status).toBe("verified");
    const counts = await pool.query<{
      documents: string;
      observations: string;
      runs: string;
      reviews: string;
    }>(`SELECT
      (SELECT count(*) FROM source_documents WHERE source_id='treatment-feed') AS documents,
      (SELECT count(*) FROM source_observations) AS observations,
      (SELECT count(*) FROM ingestion_runs WHERE source_id='treatment-feed') AS runs,
      (SELECT count(*) FROM source_observation_reviews) AS reviews`);
    expect(counts.rows[0]).toEqual({
      documents: "1",
      observations: "12",
      runs: "1",
      reviews: "6",
    });
  });

  it("refuses foreign evidence instead of mixing test and real records", async () => {
    const run = await pool.query<{ id: string }>(
      "SELECT id FROM ingestion_runs WHERE source_id='treatment-feed' LIMIT 1",
    );
    await pool.query(
      `INSERT INTO source_documents(source_id,ingestion_run_id,canonical_url,
       retrieved_at,last_seen_at,content_hash_sha256,content_type,raw_json)
       VALUES('treatment-feed',$1,'https://example.org/actual',now(),now(),$2,'application/json','{}')`,
      [run.rows[0]!.id, "a".repeat(64)],
    );
    await expect(seedDemoTreatments(pool)).rejects.toThrow(
      "non-demo provider documents",
    );
    expect(
      (await pool.query("SELECT count(*) FROM source_observations")).rows[0]
        .count,
    ).toBe("12");
  });
});
