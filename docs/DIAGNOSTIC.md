# Diagnostics

Use this checklist before changing code to fix a startup or source-access failure.

| Symptom                           | Inspect                                                                | Likely resolution                                                                              |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| API exits immediately             | Startup hint, `apps/api/.env`, `docker compose ps`, PostgreSQL logs    | Correct the reported configuration/connection error; apply migrations when required            |
| Readiness returns HTTP 503        | `curl -i http://127.0.0.1:3001/health/ready`                           | Check database availability and pool connectivity                                              |
| Web UI cannot load sources        | Browser network request to `/api/v1/sources` and API status            | Start API and verify Vite proxy on port 5173                                                   |
| Weather panel reports unavailable | `/api/v1/locations/inspect`, provider connectivity, configured timeout | Inspect Open-Meteo availability and local connectivity; no synthetic fallback                  |
| Invalid coordinates               | `lat` between -90 and 90, `lon` between -180 and 180                   | Correct query; API returns typed HTTP 400                                                      |
| Database migration fails          | `pnpm db:migrate` output and existing `schema_migrations`              | Fix connectivity or reconcile a changed historical SQL file; do not rewrite applied migrations |
| Browser E2E cannot launch         | Chromium installation, Playwright output, database readiness           | Install Playwright Chromium and start PostGIS                                                  |
| Port conflict                     | Ports 3001 (API), 5173 (web), 5433 (database)                          | Free the conflicting port or adjust documented configuration                                   |

API errors include a `requestId` and the `X-Request-ID` response header. Use that ID to correlate a problem; avoid logging credentials or private apiary locations.

## Evidence for a bug report

Record the failing command, redacted environment, HTTP status/error code and request ID, reproducible steps, actual versus expected behavior, and focused test result. For provider issues record source identity, retrieval time, timeout or status and safe response metadata. Do not include raw private data or secret-bearing URLs.

See [CONFIGURATION](CONFIGURATION.md), [USAGE](USAGE.md) and [TESTS](TESTS.md) for configuration, app behavior and checks.
