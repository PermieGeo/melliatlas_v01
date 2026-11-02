// Feature IDs: SOURCES.DOCUMENT_HISTORY, SOURCES.PROVIDER_CONFIGURATION
import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabasePool } from "./db/pool.js";
import { SourceRepository } from "./db/sourceRepository.js";
import { ProviderConfigurationRepository } from "./modules/sources/providerConfiguration.js";
import { TreatmentIngestionService } from "./modules/sources/treatmentIngestion.js";
import { DistrictCacheRepository } from "./modules/sources/districtCacheRepository.js";
import { OpenMeteoAdapter } from "./modules/weather/openMeteo.js";
import { describeStartupFailure } from "./startupDiagnostics.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const pool = createDatabasePool(config.DATABASE_URL);

  try {
    await pool.query("SELECT 1");
    const sources = new SourceRepository(pool);
    const weather = new OpenMeteoAdapter(fetch, config.OPEN_METEO_TIMEOUT_MS);
    const providerConfiguration = new ProviderConfigurationRepository(pool);
    const treatmentFeed = new TreatmentIngestionService(pool);
    const districtCache = new DistrictCacheRepository(pool);
    const app = createApp({
      providerConfiguration,
      treatmentFeed,
      districtCache,
      inspectLocation: (point) => weather.inspect(point),
      listSources: () => sources.list(),
      checkReadiness: async () => {
        await pool.query("SELECT 1");
        return true;
      },
    });

    const server = app.listen(config.PORT, "127.0.0.1", () => {
      console.info(
        `MelliAtlas local admin API listening at http://127.0.0.1:${config.PORT}`,
      );
    });
    const stop = () => {
      server.close(() => {
        void pool.end().then(() => process.exit(0));
      });
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  } catch (error) {
    await pool.end();
    throw error;
  }
}

start().catch((error: unknown) => {
  console.error("API startup failed: " + describeStartupFailure(error));
  process.exitCode = 1;
});
