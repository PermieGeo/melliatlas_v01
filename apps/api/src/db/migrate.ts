import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { loadConfig } from "../config.js";
import { createDatabasePool } from "./pool.js";

async function migrate(): Promise<void> {
  const config = loadConfig();
  const pool = createDatabasePool(config.DATABASE_URL);
  const connection = await pool.connect();

  try {
    await connection.query(
      "SELECT pg_advisory_lock(hashtext('melliatlas_migrations'))",
    );
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum_sha256 CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationDirectory = new URL("../../migrations/", import.meta.url);
    const migrations = (await readdir(migrationDirectory))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort();
    if (migrations.length === 0) {
      throw new Error("No SQL migrations found");
    }

    for (const version of migrations) {
      const sql = await readFile(new URL(version, migrationDirectory), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const prior = await connection.query<{ checksum_sha256: string }>(
        "SELECT checksum_sha256 FROM schema_migrations WHERE version = $1",
        [version],
      );
      if (prior.rowCount) {
        if (prior.rows[0].checksum_sha256.trim() !== checksum) {
          throw new Error(`Applied migration has changed: ${version}`);
        }
        continue;
      }

      await connection.query("BEGIN");
      try {
        await connection.query(sql);
        await connection.query(
          "INSERT INTO schema_migrations (version, checksum_sha256) VALUES ($1, $2)",
          [version, checksum],
        );
        await connection.query("COMMIT");
        console.info(`Applied migration ${version}`);
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try {
      await connection.query(
        "SELECT pg_advisory_unlock(hashtext('melliatlas_migrations'))",
      );
    } finally {
      connection.release();
      await pool.end();
    }
  }
}

migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
});
