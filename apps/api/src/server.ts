import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabasePool } from "./db/pool.js";
import { SourceRepository } from "./db/sourceRepository.js";
import { OpenMeteoAdapter } from "./modules/weather/openMeteo.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const pool = createDatabasePool(config.DATABASE_URL);

  try {
    await pool.query("SELECT 1");
    const sources = new SourceRepository(pool);
    const weather = new OpenMeteoAdapter(fetch, config.OPEN_METEO_TIMEOUT_MS);
    const app = createApp({
      inspectLocation: (point) => weather.inspect(point),
      listSources: () => sources.list(),
      checkReadiness: async () => {
        await pool.query("SELECT 1");
        return true;
      },
    });

    const server = app.listen(config.PORT, () => {
      console.info(`MelliAtlas API listening on port ${config.PORT}`);
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

start().catch(() => {
  console.error(
    "API startup failed; verify DATABASE_URL, migrations and PostgreSQL readiness",
  );
  process.exitCode = 1;
});
