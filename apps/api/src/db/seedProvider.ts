// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import { createDatabasePool } from "./pool.js";
import { parseProviderSeed, seedProvider } from "../modules/sources/providerSeed.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const replace = args.includes("--replace");
  const files = args.filter((arg) => arg !== "--replace");
  if (files.length !== 1 || files[0].startsWith("-")) {
    throw new Error("Usage: pnpm provider:seed <preset.json> [--replace]");
  }
  const raw = await readFile(resolve(files[0]), "utf8");
  const preset = parseProviderSeed(JSON.parse(raw) as unknown);
  const config = loadConfig();
  const pool = createDatabasePool(config.DATABASE_URL);
  try {
    const outcome = await seedProvider(pool, preset, { replace });
    console.info(`Provider preset: ${outcome} (source=treatment-feed)`);
    if (outcome === "preserved_customization") {
      console.info("Existing operator configuration was preserved; use --replace only for an intentional reset.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Provider seed failed");
  process.exitCode = 1;
});
