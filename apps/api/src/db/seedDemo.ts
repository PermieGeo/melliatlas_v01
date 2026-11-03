import "dotenv/config";
import { loadConfig } from "../config.js";
import { seedDemoTreatments } from "../modules/sources/demoSeed.js";
import { createDatabasePool } from "./pool.js";
import { requireDemoDatabase } from "./demoSafety.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createDatabasePool(config.DATABASE_URL);
  try {
    const result = await pool.query<{ current_database: string }>(
      "SELECT current_database()",
    );
    requireDemoDatabase(config.DATABASE_URL, result.rows[0]!.current_database);
    const seeded = await seedDemoTreatments(pool);
    console.info(
      `${seeded.inserted ? "Inserted" : "Preserved"} ${seeded.observations} synthetic demo observations`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo seed failed");
  process.exitCode = 1;
});
