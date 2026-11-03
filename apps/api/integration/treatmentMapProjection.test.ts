// Feature IDs: NOTICES.MAP_OVERLAY, NOTICES.SPATIAL_PRECISION
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { listStoredMapTreatments } from "../src/modules/sources/treatmentMapProjection.js";

let rootPool: Pool;
let pool: Pool;
let schema: string;
const sourceUrl = "https://example.org/treatments";

async function insertVersion(
  version: number,
  coordinates: number[][],
): Promise<string> {
  const run = await pool.query<{ id: string }>(
    `INSERT INTO ingestion_runs(source_id,status,completed_at)
     VALUES('treatment-feed','succeeded',now()) RETURNING id`,
  );
  const date = `2026-11-0${version}T00:00:00Z`;
  const doc = await pool.query<{ id: string }>(
    `INSERT INTO source_documents(source_id, ingestion_run_id, canonical_url,
      retrieved_at, last_seen_at, content_hash_sha256, content_type, raw_json)
     VALUES('treatment-feed',$1,$2,$3,$3,$4,'application/json',$5::jsonb) RETURNING id`,
    [
      run.rows[0]!.id,
      sourceUrl,
      date,
      String(version).repeat(64),
      JSON.stringify({ version }),
    ],
  );
  const observed = await pool.query<{ id: string }>(
    `INSERT INTO source_observations(source_document_id,observation_type,
      geometry,spatial_precision,extraction_method,review_status,attributes)
     VALUES($1,'treatment_plan',ST_GeomFromGeoJSON($2),'exact_polygon',
       'structured','pending',$3::jsonb) RETURNING id`,
    [
      doc.rows[0]!.id,
      JSON.stringify({ type: "Polygon", coordinates: [coordinates] }),
      JSON.stringify({ externalId: "relocated-field", treatments: [] }),
    ],
  );
  return observed.rows[0]!.id;
}

describe("latest observation precedence before viewport filtering (PostGIS)", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    schema = `map_projection_${randomBytes(6).toString("hex")}`;
    rootPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await rootPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    for (const name of [
      "001_source_core.sql",
      "010_provider_document_last_seen.sql",
    ]) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    }
    await pool.query(
      `INSERT INTO source_catalog(id,name,kind,lifecycle,url)
       VALUES('treatment-feed','Fixture','treatment','configured',$1)`,
      [sourceUrl],
    );
  }, 20_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (rootPool) {
      await rootPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rootPool.end();
    }
  });

  it("never resurrects an older polygon when its latest revision moves or is rejected", async () => {
    await insertVersion(1, [
      [31, 54],
      [32, 54],
      [32, 55],
      [31, 54],
    ]);
    const latestId = await insertVersion(2, [
      [34, 54],
      [35, 54],
      [35, 55],
      [34, 54],
    ]);
    expect(
      await listStoredMapTreatments(
        pool,
        "treatment-feed",
        false,
        [30, 53, 33, 56],
      ),
    ).toEqual([]);
    const visible = await listStoredMapTreatments(
      pool,
      "treatment-feed",
      false,
      [33, 53, 36, 56],
    );
    expect(visible.map((item) => item.id)).toEqual([latestId]);
    await pool.query(
      "UPDATE source_observations SET review_status='rejected' WHERE id=$1",
      [latestId],
    );
    expect(
      await listStoredMapTreatments(
        pool,
        "treatment-feed",
        false,
        [30, 53, 33, 56],
      ),
    ).toEqual([]);
    expect(
      await listStoredMapTreatments(
        pool,
        "treatment-feed",
        false,
        [33, 53, 36, 56],
      ),
    ).toEqual([]);
  });
});
