// Feature IDs: SOURCES.CATALOG, SOURCES.SAFE_FETCH
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import { MunicipalSourceRegistry } from "../src/modules/sources/municipalSourceRegistry.js";
import { evaluateSourceDestination } from "../src/modules/sources/destinationPolicy.js";

const sourceId = "fixture-municipality";
const locations = [
  { hostname: "notices.example.org", pathPrefixes: ["/announcements"] },
];
const fetchPolicy = {
  timeoutMs: 4000,
  maxResponseBytes: 200_000,
  minIntervalMs: 60_000,
  maxRedirects: 0,
  maxRetries: 1,
  allowedContentTypes: ["text/html"],
};

let pool: Pool;
let client: PoolClient;

async function rejectedWrite(
  sql: string,
  params: unknown[] = [],
  expectedCode = "23514",
) {
  await client.query("SAVEPOINT invalid_source_write");
  let failure: unknown;
  try {
    await client.query(sql, params);
  } catch (error) {
    failure = error;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT invalid_source_write");
    await client.query("RELEASE SAVEPOINT invalid_source_write");
  }
  expect(failure).toMatchObject({ code: expectedCode });
}

describe("real PostGIS catalog migration and read policy", () => {
  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url)
      throw new Error("DATABASE_URL is required for PostGIS integration tests");

    pool = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
    client = await pool.connect();
    const schema = `source_registry_test_${randomBytes(6).toString("hex")}`;
    const migrations = new URL("../migrations/", import.meta.url);
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    await client.query(
      await readFile(new URL("001_source_core.sql", migrations), "utf8"),
    );
    await client.query(
      "INSERT INTO source_catalog (id, name, kind, lifecycle, url) VALUES ($1, $2, $3, $4, $5)",
      [
        sourceId,
        "Synthetic municipality",
        "municipal_notice",
        "under_review",
        "https://notices.example.org/announcements",
      ],
    );
    await client.query(
      await readFile(
        new URL("002_source_access_registry.sql", migrations),
        "utf8",
      ),
    );
  }, 20_000);

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    if (pool) await pool.end();
  });

  it("upgrades existing records without granting ingestion permission", async () => {
    const rows = await client.query<{
      id: string;
      access_decision: string;
      allowed_locations: unknown[];
      registry_revision: string;
    }>(
      "SELECT id, access_decision, allowed_locations, registry_revision FROM source_catalog ORDER BY id",
    );
    expect(rows.rows).toHaveLength(3);
    expect(rows.rows.every((row) => row.access_decision === "pending")).toBe(
      true,
    );
    expect(rows.rows.every((row) => row.allowed_locations.length === 0)).toBe(
      true,
    );
    expect(rows.rows.every((row) => row.registry_revision === "1")).toBe(true);
    const history = await client.query<{ count: string }>(
      "SELECT count(*) FROM source_catalog_versions",
    );
    expect(history.rows[0].count).toBe("3");
    const registry = new MunicipalSourceRegistry(client as unknown as Pool);
    await expect(registry.getApproved(sourceId)).resolves.toBeNull();
  });

  it("enforces access-review constraints before an approval can be stored", async () => {
    await rejectedWrite(
      "UPDATE source_catalog SET access_decision = 'approved' WHERE id = $1",
      [sourceId],
    );
    await rejectedWrite(
      "UPDATE source_catalog SET access_decision = 'approved' WHERE id = 'open-meteo'",
    );
    await rejectedWrite(
      "UPDATE source_catalog SET allowed_locations = '{}'::jsonb WHERE id = $1",
      [sourceId],
    );
    await rejectedWrite(
      "UPDATE source_catalog SET refresh_interval_ms = 0 WHERE id = $1",
      [sourceId],
    );
  });

  it("loads a fully approved municipal registration and preserves a new revision", async () => {
    const changed = await client.query<{ registry_revision: string }>(
      `UPDATE source_catalog SET
        lifecycle = 'configured', terms_review = 'reviewed', access_decision = 'approved',
        allowed_locations = $2::jsonb, fetch_policy = $3::jsonb,
        reviewed_by = 'test-operator', reviewed_at = $4::timestamptz,
        permission_evidence_url = 'https://example.org/synthetic-terms',
        permission_basis = 'Synthetic approval for PostGIS integration only',
        parser_version = 'html-v1', data_purpose = 'Municipal notice evidence'
       WHERE id = $1 RETURNING registry_revision`,
      [
        sourceId,
        JSON.stringify(locations),
        JSON.stringify(fetchPolicy),
        "2026-10-31T12:00:00.000Z",
      ],
    );
    expect(changed.rows[0].registry_revision).toBe("2");
    const registry = new MunicipalSourceRegistry(client as unknown as Pool);
    const approved = await registry.getApproved(sourceId);
    expect(approved?.registryRevision).toBe("2");
    expect(
      evaluateSourceDestination(
        approved?.source,
        "https://notices.example.org/announcements/1",
      ),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateSourceDestination(
        approved?.source,
        "https://elsewhere.example.org/announcements",
      ),
    ).toEqual({ allowed: false, reason: "FORBIDDEN_HOST" });
    const versions = await client.query<{ registry_revision: string }>(
      "SELECT registry_revision FROM source_catalog_versions WHERE source_id = $1 ORDER BY registry_revision",
      [sourceId],
    );
    expect(versions.rows.map((row) => row.registry_revision)).toEqual([
      "1",
      "2",
    ]);
  });

  it("keeps cursor/freshness updates out of policy revision history", async () => {
    const changed = await client.query<{ registry_revision: string }>(
      `UPDATE source_catalog SET source_cursor = '{"page":2}'::jsonb,
        last_successful_ingest_at = '2026-10-31T13:00:00Z'
       WHERE id = $1 RETURNING registry_revision`,
      [sourceId],
    );
    expect(changed.rows[0].registry_revision).toBe("2");
    const versions = await client.query<{ count: string }>(
      "SELECT count(*) FROM source_catalog_versions WHERE source_id = $1",
      [sourceId],
    );
    expect(versions.rows[0].count).toBe("2");
  });

  it("increments on access policy changes and refuses history rewriting", async () => {
    const changed = await client.query<{ registry_revision: string }>(
      "UPDATE source_catalog SET refresh_interval_ms = 120000 WHERE id = $1 RETURNING registry_revision",
      [sourceId],
    );
    expect(changed.rows[0].registry_revision).toBe("3");
    const latest = await client.query<{ snapshot: Record<string, unknown> }>(
      "SELECT snapshot FROM source_catalog_versions WHERE source_id = $1 AND registry_revision = 3",
      [sourceId],
    );
    expect(latest.rows[0].snapshot.refresh_interval_ms).toBe(120000);
    expect(latest.rows[0].snapshot).not.toHaveProperty("source_cursor");
    await rejectedWrite(
      "UPDATE source_catalog_versions SET snapshot = '{}'::jsonb WHERE source_id = $1",
      [sourceId],
      "P0001",
    );
  });

  it("rejects malformed persisted hosts before a later worker can fetch", async () => {
    await client.query("SAVEPOINT malformed_allowed_host");
    try {
      await client.query(
        "UPDATE source_catalog SET allowed_locations = $2::jsonb WHERE id = $1",
        [
          sourceId,
          JSON.stringify([{ hostname: "127.0.0.1", pathPrefixes: ["/"] }]),
        ],
      );
      const registry = new MunicipalSourceRegistry(client as unknown as Pool);
      await expect(registry.getApproved(sourceId)).rejects.toThrow(
        "Invalid approved source registration",
      );
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT malformed_allowed_host");
      await client.query("RELEASE SAVEPOINT malformed_allowed_host");
    }
  });
});
