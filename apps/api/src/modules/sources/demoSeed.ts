// Feature IDs: NOTICES.MAP_OVERLAY, SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  DEMO_OBSERVATIONS,
  DEMO_RETRIEVED_AT,
  DEMO_SOURCE_NAME,
  DEMO_SOURCE_URL,
} from "./demoFixtures.js";

export type DemoSeedResult = { inserted: boolean; observations: number };

const SOURCE_ID = "treatment-feed";
const PAYLOAD = JSON.stringify({ synthetic: true, records: DEMO_OBSERVATIONS });
const HASH = createHash("sha256").update(PAYLOAD).digest("hex");

/** Refuse to overwrite any non-demo evidence, including a partially initialized source. */
async function inspectExisting(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ canonical_url: string }>(
    "SELECT canonical_url FROM source_documents WHERE source_id=$1 FOR UPDATE",
    [SOURCE_ID],
  );
  if (result.rows.some((row) => row.canonical_url !== DEMO_SOURCE_URL)) {
    throw new Error(
      "Demo seeding refuses a database with non-demo provider documents",
    );
  }
  return result.rows.length > 0;
}

/** Insert complete, visibly synthetic evidence using production PostGIS tables. */
export async function seedDemoTreatments(pool: Pool): Promise<DemoSeedResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('melliatlas_demo_seed'))",
    );
    if (await inspectExisting(client)) {
      await client.query("COMMIT");
      return { inserted: false, observations: DEMO_OBSERVATIONS.length };
    }
    const source = await client.query<{ id: string }>(
      "SELECT id FROM source_catalog WHERE id=$1 FOR UPDATE",
      [SOURCE_ID],
    );
    if (!source.rowCount)
      throw new Error("Run database migrations before demo seeding");
    await client.query(
      `UPDATE source_catalog SET name=$2, url=$3, lifecycle='configured',
         terms_review='pending', access_decision='pending', source_cursor=NULL,
         api_key=NULL, disabled_reason=NULL, data_purpose='SYNTHETIC DEMO FIXTURE ONLY',
         last_successful_ingest_at=$5, api_request_config=$4::jsonb WHERE id=$1`,
      [
        SOURCE_ID,
        DEMO_SOURCE_NAME,
        DEMO_SOURCE_URL,
        JSON.stringify({
          endpoint: DEMO_SOURCE_URL,
          request: {
            method: "POST",
            regionParameter: "subject",
            regionCode: 55,
            parameters: { pageNumber: 0, pageSize: 10 },
          },
        }),
        DEMO_RETRIEVED_AT,
      ],
    );
    const run = await client.query<{ id: string }>(
      `INSERT INTO ingestion_runs(source_id, status, started_at, completed_at,
         discovered_count, accepted_count)
       VALUES($1,'succeeded',$2,$2,$3,$3) RETURNING id`,
      [SOURCE_ID, DEMO_RETRIEVED_AT, DEMO_OBSERVATIONS.length],
    );
    const document = await client.query<{ id: string }>(
      `INSERT INTO source_documents(source_id,ingestion_run_id,canonical_url,
         external_id,retrieved_at,last_seen_at,content_hash_sha256,content_type,raw_json)
       VALUES($1,$2,$3,'DEMO-DOCUMENT-001',$4,$4,$5,'application/json',$6::jsonb) RETURNING id`,
      [
        SOURCE_ID,
        run.rows[0]!.id,
        DEMO_SOURCE_URL,
        DEMO_RETRIEVED_AT,
        HASH,
        PAYLOAD,
      ],
    );
    for (const [index, observation] of DEMO_OBSERVATIONS.entries()) {
      await client.query(
        `INSERT INTO source_observations(id,source_document_id,observation_type,
           start_at,end_at,geometry,spatial_precision,extraction_method,
           review_status,attributes)
         VALUES($1,$2,'treatment_plan',$3,$4,
           CASE WHEN $5::jsonb IS NULL THEN NULL ELSE ST_GeomFromGeoJSON($5::text) END,
           $6,'structured',$7,$8::jsonb)`,
        [
          observation.id,
          document.rows[0]!.id,
          observation.startAt,
          observation.endAt,
          observation.geometry ? JSON.stringify(observation.geometry) : null,
          observation.geometry ? "exact_polygon" : "text_only",
          observation.reviewStatus,
          JSON.stringify({
            synthetic: true,
            recordIndex: index,
            externalId: observation.externalId,
            sourceName: DEMO_SOURCE_NAME,
            contractorName: observation.contractorName,
            cadastralNumber: observation.cadastralNumber,
            treatments: observation.treatments,
          }),
        ],
      );
      if (observation.reviewStatus !== "pending") {
        await client.query(
          `INSERT INTO source_observation_reviews(observation_id,reviewer,decision,evidence_note)
           VALUES($1,'DEMO test operator',$2,$3)`,
          [
            observation.id,
            observation.reviewStatus,
            "SYNTHETIC DEMO ONLY: simulated review state, not real-world verification.",
          ],
        );
      }
    }
    await client.query("COMMIT");
    return { inserted: true, observations: DEMO_OBSERVATIONS.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
