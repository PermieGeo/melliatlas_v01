# Configuration

## Backend environment

Copy `apps/api/.env.example` to `apps/api/.env`. The API uses `dotenv` and validates its configuration with Zod at startup.

| Variable                | Default/example                                                            | Meaning                                               |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `NODE_ENV`              | `development`                                                              | `development`, `test`, `production`                   |
| `SATURN_OPERATOR_TOKEN` | Unset (operator API disabled) | Optional server-only bearer token (at least 32 characters); never commit or store in the browser |
| `PORT`                  | `3001`                                                                     | API listening port, 1–65535                           |
| `DATABASE_URL`          | `postgresql://melliatlas:local_development_only@127.0.0.1:5433/melliatlas` | Required PostgreSQL connection URL                    |
| `OPEN_METEO_TIMEOUT_MS` | `8000`                                                                     | Weather-provider timeout; allowed range 1000–30000 ms |

The Compose database uses `POSTGRES_PASSWORD` as an optional override, with a local-only default. If changed, update `DATABASE_URL` to match. The database is bound to `127.0.0.1:5433` in `compose.yaml`.

## Web configuration

`apps/web/vite.config.ts` serves the web UI on port 5173 and proxies `/api` to `http://127.0.0.1:3001` in local development. Its dev server binds to `127.0.0.1`. The client uses relative `/api/v1` paths; production hosting must provide equivalent routing.

## Planned configuration

Migration `002_source_access_registry.sql` stores proposed municipal-source hosts, paths, review decisions, fetch policy, polling interval and parser version in PostgreSQL; approved records can be read by an internal repository. **An authenticated operator Saturn configuration API is available when `SATURN_OPERATOR_TOKEN` is set; it does not fetch anything.** Migration `003_saturn_api_configuration.sql` adds an unapproved candidate Saturn source with an operator-private editable endpoint (separate from the public portal URL), GET/POST mode, region field/code and flat request parameters. Serve the operator UI and API through HTTPS (localhost is acceptable for development). Only the API host process sees `SATURN_OPERATOR_TOKEN`; the browser holds the supplied token in memory until navigating away/reloading. Existing catalog entries remain unapproved by default. Future AI-agent settings include provider/model, credentials, tool allowlist and run budgets. Do not add unimplemented variables to production deployment files.

Never commit `.env` files, API keys, personal coordinates or production credentials.
