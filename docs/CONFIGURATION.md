# Configuration

## Backend environment

Copy `apps/api/.env.example` to `apps/api/.env`. The API uses `dotenv` and validates its configuration with Zod at startup.

| Variable                | Default/example                                                            | Meaning                                               |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `NODE_ENV`              | `development`                                                              | `development`, `test`, `production`                   |
| `PORT`                  | `3001`                                                                     | API listening port, 1–65535                           |
| `DATABASE_URL`          | `postgresql://melliatlas:local_development_only@127.0.0.1:5433/melliatlas` | Required PostgreSQL connection URL                    |
| `OPEN_METEO_TIMEOUT_MS` | `8000`                                                                     | Weather-provider timeout; allowed range 1000–30000 ms |

The Compose database uses `POSTGRES_PASSWORD` as an optional override, with a local-only default. If changed, update `DATABASE_URL` to match. The database is bound to `127.0.0.1:5433` in `compose.yaml`.

## Web configuration

`apps/web/vite.config.ts` serves the web UI on port 5173 and proxies `/api` to `http://127.0.0.1:3001` in local development. Its dev server binds to `127.0.0.1`. The client uses relative `/api/v1` paths; production hosting must provide equivalent routing.

## Planned configuration

Future source-ingestion settings include per-source approved domains, access policy, polling interval, quotas and parser versions. Future AI-agent settings include provider/model, credentials, tool allowlist and run budgets. **These settings are specified in the umbrella, but are not recognized by the current executable API.** Do not add unimplemented variables to production deployment files.

Never commit `.env` files, API keys, personal coordinates or production credentials.
