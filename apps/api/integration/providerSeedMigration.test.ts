// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import { ProviderConfigurationRepository } from "../src/modules/sources/providerConfiguration.js";
import {
  parseProviderSeed,
  seedProvider,
} from "../src/modules/sources/providerSeed.js";

let pool: Pool;
let client: PoolClient;

const preset = parseProviderSeed({
  name: "Test portal",
  type: "treatment",
  url: "https://bee-saturn.ru/backend/beemaster/planapplybees",
  request: {
    method: "POST",
    regionParameter: "subject",
    regionContainer: "beekeperSearchFilter",
    regionCode: 55,
    parameters: {
      pageNumber: 0,
      pageSize: 40,
      sortColumn: "datePublishing",
      sortDirection: "desc",
    },
  },
});

// Keep the production seeder's connection contract while querying an isolated transaction.
function transactionalPool(): Pool {
  return {
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => {
        if (sql === "BEGIN") return client.query("SAVEPOINT provider_seed_tx");
        if (sql === "COMMIT")
          return client.query("RELEASE SAVEPOINT provider_seed_tx");
        if (sql === "ROLLBACK")
          return client.query("ROLLBACK TO SAVEPOINT provider_seed_tx");
        return client.query(sql, params);
      },
      release: () => {},
    }),
  } as unknown as Pool;
}

describe("provider seed upgrade and credential isolation (PostGIS)", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error(
        "DATABASE_URL is required for provider seed migration tests",
      );
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
    });
    client = await pool.connect();
    const schema = `provider_seed_${randomBytes(6).toString("hex")}`;
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

  it("seeds an existing placeholder once, stores type/url/empty key, and keeps access pending", async () => {
    const db = transactionalPool();
    expect(await seedProvider(db, preset)).toBe("updated");
    const saved = await client.query(
      "SELECT name, kind, url, api_key, access_decision, lifecycle FROM source_catalog WHERE id = 'treatment-feed'",
    );
    expect(saved.rows[0]).toEqual({
      name: "Test portal",
      kind: "treatment",
      url: preset.url,
      api_key: null,
      access_decision: "pending",
      lifecycle: "configured",
    });
    const repo = new ProviderConfigurationRepository(client as unknown as Pool);
    const publicConfig = await repo.get();
    expect(publicConfig.endpoint).toBe(preset.url);
    expect(publicConfig).not.toHaveProperty("apiKey");
    expect(await seedProvider(db, preset)).toBe("unchanged");
    const versions = await client.query(
      "SELECT count(*)::int AS total FROM source_catalog_versions WHERE source_id = 'treatment-feed'",
    );
    expect(versions.rows[0].total).toBe(2);
  });

  it("redacts future credentials from immutable revision history and refuses implicit override", async () => {
    const db = transactionalPool();
    await client.query(
      "UPDATE source_catalog SET api_key = $1 WHERE id = 'treatment-feed'",
      ["test-secret"],
    );
    const audit = await client.query(
      "SELECT snapshot FROM source_catalog_versions WHERE source_id = 'treatment-feed' ORDER BY registry_revision DESC LIMIT 1",
    );
    expect(audit.rows[0].snapshot).not.toHaveProperty("api_key");
    const catalog = await client.query(
      "SELECT api_key FROM source_catalog WHERE id = 'treatment-feed'",
    );
    expect(catalog.rows[0].api_key).toBe("test-secret");
    expect(await seedProvider(db, preset)).toBe("preserved_customization");
    expect(await seedProvider(db, preset, { replace: true })).toBe("updated");
    const after = await client.query(
      "SELECT api_key, access_decision FROM source_catalog WHERE id = 'treatment-feed'",
    );
    expect(after.rows[0]).toEqual({
      api_key: null,
      access_decision: "pending",
    });
    const revisions = await client.query(
      "SELECT snapshot FROM source_catalog_versions WHERE source_id = 'treatment-feed'",
    );
    expect(
      revisions.rows.every((row) => !Object.hasOwn(row.snapshot, "api_key")),
    ).toBe(true);
  });

  it("does not carry keys to a different endpoint through UI edits", async () => {
    await client.query(
      "UPDATE source_catalog SET api_key = 'test-secret' WHERE id = 'treatment-feed'",
    );
    const repo = new ProviderConfigurationRepository(client as unknown as Pool);
    const current = await repo.get();
    await repo.update({
      providerName: "New endpoint",
      endpoint: "https://different.example.org/plans",
      expectedRevision: current.revision,
      request: current.request,
    });
    const row = await client.query(
      "SELECT api_key, access_decision FROM source_catalog WHERE id = 'treatment-feed'",
    );
    expect(row.rows[0]).toEqual({ api_key: null, access_decision: "pending" });
  });
});
