// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import { ProviderConfigurationRepository } from "../src/modules/sources/providerConfiguration.js";

let pool: Pool;
let client: PoolClient;

describe("Provider configuration migration against PostgreSQL", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error(
        "DATABASE_URL is required for Provider/PostGIS migration tests",
      );
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
    });
    client = await pool.connect();
    const schema = `provider_test_${randomBytes(6).toString("hex")}`;
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    const directory = new URL("../migrations/", import.meta.url);
    for (const filename of [
      "001_source_core.sql",
      "002_source_access_registry.sql",
      "003_saturn_api_configuration.sql",
      "004_provider_connection.sql",
      "005_treatment_source_approval.sql",
      "006_optional_provider_api_key.sql",
    ]) {
      await client.query(await readFile(new URL(filename, directory), "utf8"));
    }
  }, 20_000);
  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    if (pool) await pool.end();
  });

  it("seeds a disabled, pending candidate while preserving earlier catalog revisions", async () => {
    const repo = new ProviderConfigurationRepository(client as unknown as Pool);
    const row = await repo.get();
    expect(row.providerName).toBe("External treatment provider");
    expect(row).toMatchObject({
      revision: "1",
      collectionEnabled: false,
      request: {
        regionCode: 55,
        regionContainer: "beekeperSearchFilter",
        parameters: { pageNumber: 0, pageSize: 40 },
      },
    });
    const state = await client.query(
      "SELECT lifecycle, terms_review, access_decision, allowed_locations FROM source_catalog WHERE id = 'treatment-feed'",
    );
    expect(state.rows[0]).toMatchObject({
      lifecycle: "under_review",
      terms_review: "pending",
      access_decision: "pending",
      allowed_locations: [],
    });
  });

  it("hides the superseded legacy row without deleting audit history", async () => {
    const legacy = await client.query(
      "SELECT disabled_reason FROM source_catalog WHERE id = 'saturn'",
    );
    expect(legacy.rows[0]?.disabled_reason).toBe(
      "superseded-by-configurable-provider",
    );
    const version = await client.query(
      "SELECT count(*)::int AS total FROM source_catalog_versions WHERE source_id = 'saturn'",
    );
    expect(version.rows[0].total).toBeGreaterThan(0);
  });

  it("persists edits with revision history and rejects stale writes", async () => {
    const repo = new ProviderConfigurationRepository(client as unknown as Pool);
    const saved = await repo.update({
      providerName: "Regional treatment bulletin",
      endpoint: "https://example.org/v2/plans",
      expectedRevision: "1",
      request: {
        method: "GET",
        regionParameter: "region",
        regionCode: 67,
        parameters: { page: 1 },
      },
    });
    expect(saved.revision).toBe("2");
    expect(saved.request).toEqual({
      method: "GET",
      regionParameter: "region",
      regionCode: 67,
      parameters: { page: 1 },
    });
    const reread = await repo.get();
    expect(reread.endpoint).toBe("https://example.org/v2/plans");
    expect(reread.providerName).toBe("Regional treatment bulletin");
    expect(reread.collectionEnabled).toBe(false);
    const revisions = await client.query(
      "SELECT registry_revision FROM source_catalog_versions WHERE source_id = 'treatment-feed' ORDER BY registry_revision",
    );
    expect(
      revisions.rows.map(
        (item: { registry_revision: string }) => item.registry_revision,
      ),
    ).toEqual(["1", "2"]);
    await expect(
      repo.update({
        providerName: "Test Provider",
        endpoint: "https://example.org/old",
        expectedRevision: "1",
        request: saved.request,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_REVISION_CONFLICT" });
  });
});
