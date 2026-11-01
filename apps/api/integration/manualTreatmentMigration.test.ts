// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, SOURCES.DOCUMENT_HISTORY
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

let pool: Pool;
let client: PoolClient;
const migrations = new URL("../migrations/", import.meta.url);

async function apply(name: string): Promise<void> {
  await client.query(await readFile(new URL(name, migrations), "utf8"));
}

describe("manual treatment source migration against PostGIS", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for PostGIS integration tests");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
    });
    client = await pool.connect();
    const schema = `manual_treatment_${randomBytes(6).toString("hex")}`;
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    for (const name of [
      "001_source_core.sql",
      "002_source_access_registry.sql",
      "003_saturn_api_configuration.sql",
      "004_provider_connection.sql",
      "005_treatment_source_approval.sql",
      "006_optional_provider_api_key.sql",
      "007_treatment_observation_dedupe.sql",
    ]) {
      await apply(name);
    }
  }, 20_000);

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    if (pool) await pool.end();
  });

  it("reconciles the untouched legacy homepage and activates manual fetch without inventing evidence", async () => {
    const before = await client.query(
      `SELECT lifecycle, access_decision, url,
              api_request_config->>'endpoint' AS endpoint
         FROM source_catalog WHERE id='treatment-feed'`,
    );
    expect(before.rows[0]).toEqual({
      lifecycle: "under_review",
      access_decision: "pending",
      url: "https://bee-saturn.ru/",
      endpoint: "https://bee-saturn.ru/backend/beemaster/planapplybees",
    });

    // Migration 008 cannot activate the historical row until its URL is aligned.
    await apply("008_manual_treatment_fetch.sql");
    const intermediate = await client.query(
      "SELECT lifecycle FROM source_catalog WHERE id='treatment-feed'",
    );
    expect(intermediate.rows[0].lifecycle).toBe("under_review");

    await apply("009_legacy_treatment_endpoint_alignment.sql");
    const after = await client.query(
      "SELECT lifecycle, access_decision, url, reviewed_by, permission_evidence_url FROM source_catalog WHERE id='treatment-feed'",
    );
    expect(after.rows[0]).toEqual({
      lifecycle: "configured",
      access_decision: "pending",
      url: "https://bee-saturn.ru/backend/beemaster/planapplybees",
      reviewed_by: null,
      permission_evidence_url: null,
    });
    await apply("008_manual_treatment_fetch.sql");
    await apply("009_legacy_treatment_endpoint_alignment.sql");
    const history = await client.query(
      "SELECT count(*)::int AS total FROM source_catalog_versions WHERE source_id='treatment-feed'",
    );
    expect(history.rows[0].total).toBe(2);
  });

  it("does not silently reactivate disabled, mismatched, or customized sources", async () => {
    await client.query(
      "UPDATE source_catalog SET lifecycle='disabled' WHERE id='treatment-feed'",
    );
    await apply("008_manual_treatment_fetch.sql");
    await apply("009_legacy_treatment_endpoint_alignment.sql");
    let result = await client.query(
      "SELECT lifecycle FROM source_catalog WHERE id='treatment-feed'",
    );
    expect(result.rows[0].lifecycle).toBe("disabled");

    await client.query(
      "UPDATE source_catalog SET lifecycle='under_review', url='https://other.example.org/plans' WHERE id='treatment-feed'",
    );
    await apply("008_manual_treatment_fetch.sql");
    await apply("009_legacy_treatment_endpoint_alignment.sql");
    result = await client.query(
      "SELECT lifecycle FROM source_catalog WHERE id='treatment-feed'",
    );
    expect(result.rows[0].lifecycle).toBe("under_review");

    await client.query(
      `UPDATE source_catalog SET url='https://bee-saturn.ru/',
        api_request_config = jsonb_set(api_request_config, '{request,parameters,pageNumber}', '1'::jsonb)
        WHERE id='treatment-feed'`,
    );
    await apply("009_legacy_treatment_endpoint_alignment.sql");
    result = await client.query(
      "SELECT lifecycle, url FROM source_catalog WHERE id='treatment-feed'",
    );
    expect(result.rows[0]).toEqual({
      lifecycle: "under_review",
      url: "https://bee-saturn.ru/",
    });
  });

  it("keeps migration 008 working for an already aligned treatment endpoint", async () => {
    await client.query(
      "UPDATE source_catalog SET url=api_request_config->>'endpoint' WHERE id='treatment-feed'",
    );
    await apply("008_manual_treatment_fetch.sql");
    const row = await client.query(
      "SELECT lifecycle, access_decision FROM source_catalog WHERE id='treatment-feed'",
    );
    expect(row.rows[0]).toEqual({
      lifecycle: "configured",
      access_decision: "pending",
    });
  });
});
