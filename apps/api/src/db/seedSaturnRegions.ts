// Feature IDs: SOURCES.DOCUMENT_HISTORY
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { saturnRegionCodeSchema } from "@melliatlas/contracts";
import { loadConfig } from "../config.js";
import { createDatabasePool } from "./pool.js";

const seedSchema = z
  .object({
    regions: z
      .array(
        z
          .object({
            code: saturnRegionCodeSchema,
            name: z.string().trim().min(1).max(250),
          })
          .strict(),
      )
      .min(1)
      .max(256),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.regions.map((region) => region.code)).size ===
      value.regions.length,
    "Duplicate region code",
  );

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3 || file.startsWith("-"))
    throw new Error("Usage: pnpm saturn:regions:seed <regions.json>");
  const data = seedSchema.parse(
    JSON.parse(await readFile(resolve(file), "utf8")) as unknown,
  );
  const pool = createDatabasePool(loadConfig().DATABASE_URL);
  try {
    for (const region of data.regions) {
      await pool.query(
        `INSERT INTO source_saturn_regions (subject_code, display_name) VALUES ($1, $2)
         ON CONFLICT (subject_code) DO UPDATE SET display_name=EXCLUDED.display_name`,
        [region.code, region.name],
      );
    }
    console.info(`Registered ${data.regions.length} Saturn region(s)`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Region seed failed");
  process.exitCode = 1;
});
