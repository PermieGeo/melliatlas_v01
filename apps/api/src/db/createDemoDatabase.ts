import "dotenv/config";
import { Pool } from "pg";
import { loadConfig } from "../config.js";
import { requireDemoDatabase } from "./demoSafety.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const target = new URL(config.DATABASE_URL);
  const databaseName = target.pathname.slice(1);
  requireDemoDatabase(config.DATABASE_URL, databaseName);
  target.pathname = "/postgres";
  const pool = new Pool({ connectionString: target.toString() });
  try {
    const existing = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );
    if (existing.rowCount) return;
    try {
      await pool.query(`CREATE DATABASE "${databaseName}"`);
      console.info(`Created local database ${databaseName}`);
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "42P04"
      )) {
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Demo database creation failed",
  );
  process.exitCode = 1;
});
