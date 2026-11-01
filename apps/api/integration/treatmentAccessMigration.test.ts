// Feature IDs: SOURCES.SAFE_FETCH, SOURCES.PROVIDER_CONFIGURATION
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import { ApprovedSourceRegistry } from "../src/modules/sources/municipalSourceRegistry.js";
import { ProviderConfigurationRepository } from "../src/modules/sources/providerConfiguration.js";

let pool: Pool;
let client: PoolClient;

const locations = [
  { hostname: "public.example.org", pathPrefixes: ["/api/plans"] },
];
const policy = {
  timeoutMs: 1000,
  maxResponseBytes: 10000,
  minIntervalMs: 60000,
  maxRedirects: 1,
  maxRetries: 1,
  allowedContentTypes: ["application/json"],
};

describe("treatment feed policy migration against PostGIS", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is required for PostGIS integration tests");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
    });
    client = await pool.connect();
    const schema = `treatment_access_${randomBytes(6).toString("hex")}`;
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    const migrations = new URL("../migrations/", import.meta.url);
    for (const file of [
      "001_source_core.sql",
      "002_source_access_registry.sql",
      "003_saturn_api_configuration.sql",
      "004_provider_connection.sql",
      "005_treatment_source_approval.sql",
      "006_optional_provider_api_key.sql",
    ]) {
      await client.query(await readFile(new URL(file, migrations), "utf8"));
    }
  }, 20_000);

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    if (pool) await pool.end();
  });

  it("does not approve a candidate during upgrade and rejects incomplete approvals", async () => {
    const current = await client.query(
      "SELECT lifecycle, access_decision FROM source_catalog WHERE id = 'treatment-feed'",
    );
    expect(current.rows[0]).toMatchObject({
      lifecycle: "under_review",
      access_decision: "pending",
    });
    const registry = new ApprovedSourceRegistry(client as unknown as Pool);
    await expect(registry.getApproved("treatment-feed")).resolves.toBeNull();
    await client.query("SAVEPOINT invalid_approval");
    try {
      await expect(
        client.query(
          "UPDATE source_catalog SET access_decision='approved' WHERE id='treatment-feed'",
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT invalid_approval");
      await client.query("RELEASE SAVEPOINT invalid_approval");
    }
  });

  it("permits explicit reviewed treatment policy and revokes on reconfiguration", async () => {
    await client.query(
      `UPDATE source_catalog SET lifecycle = 'configured', terms_review = 'reviewed', access_decision = 'approved',
       allowed_locations = $1::jsonb, fetch_policy = $2::jsonb,
       reviewed_by = 'fixture-reviewer', reviewed_at = '2026-11-01T00:00:00Z',
       permission_evidence_url = 'https://example.org/permission',
       permission_basis = 'Synthetic integration test permission only',
       parser_version = 'json-fixture-v1'
       WHERE id = 'treatment-feed'`,
      [JSON.stringify(locations), JSON.stringify(policy)],
    );
    const registry = new ApprovedSourceRegistry(client as unknown as Pool);
    const approved = await registry.getApproved("treatment-feed");
    expect(approved?.source).toMatchObject({
      kind: "treatment",
      fetchPolicy: { allowedContentTypes: ["application/json"] },
    });
    const repo = new ProviderConfigurationRepository(client as unknown as Pool);
    const current = await repo.get();
    expect(current.accessDecision).toBe("approved");
    const updated = await repo.update({
      providerName: "Another provider",
      endpoint: "https://other.example.org/api/plans",
      request: current.request,
      expectedRevision: current.revision,
    });
    expect(updated.accessDecision).toBe("pending");
    await expect(registry.getApproved("treatment-feed")).resolves.toBeNull();
    const rows = await client.query(
      "SELECT lifecycle, access_decision, reviewed_by, allowed_locations, fetch_policy FROM source_catalog WHERE id='treatment-feed'",
    );
    expect(rows.rows[0]).toMatchObject({
      lifecycle: "under_review",
      access_decision: "pending",
      reviewed_by: null,
      allowed_locations: [],
      fetch_policy: null,
    });
    const versions = await client.query(
      "SELECT count(*)::int AS n FROM source_catalog_versions WHERE source_id='treatment-feed'",
    );
    expect(versions.rows[0].n).toBe(3);
  });
});
