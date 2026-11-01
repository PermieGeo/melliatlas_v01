# Diagnostics

Use this checklist before changing code to fix a startup or source-access failure.

| Symptom                             | Inspect                                                                | Likely resolution                                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API exits immediately               | Startup hint, `apps/api/.env`, `docker compose ps`, PostgreSQL logs    | Correct the reported configuration/connection error; apply migrations when required                                                                                                                      |
| Readiness returns HTTP 503          | `curl -i http://127.0.0.1:3001/health/ready`                           | Check database availability and pool connectivity                                                                                                                                                        |
| Web UI cannot load sources          | Browser network request to `/api/v1/sources` and API status            | Start API and verify Vite proxy on port 5173                                                                                                                                                             |
| Weather panel reports unavailable   | `/api/v1/locations/inspect`, provider connectivity, configured timeout | Inspect Open-Meteo availability and local connectivity; no synthetic fallback                                                                                                                            |
| Invalid coordinates                 | `lat` between -90 and 90, `lon` between -180 and 180                   | Correct query; API returns typed HTTP 400                                                                                                                                                                |
| Database migration fails            | `pnpm db:migrate` output and existing `schema_migrations`              | Fix connectivity or reconcile a changed historical SQL file; do not rewrite applied migrations                                                                                                           |
| Browser E2E cannot launch           | Chromium installation, Playwright output, database readiness           | Install Playwright Chromium and start PostGIS                                                                                                                                                            |
| Port conflict                       | Ports 3001 (API), 5173 (web), 5433 (database)                          | Free the conflicting port or adjust documented configuration                                                                                                                                             |
| Operator settings show 503          | `SOURCE_OPERATOR_TOKEN`, startup log, applied migrations `003`–`005`   | Supply an operator token of at least 32 characters and restart API; apply migrations if needed                                                                                                           |
| Operator settings show 401          | Entered bearer token versus backend environment                        | Use the application operator token, not an external provider credential                                                                                                                                  |
| Operator save shows 409             | Current settings revision changed                                      | Reopen settings to load the new revision, then reapply the intended edit                                                                                                                                 |
| Configured provider has no map data | API routes and ingestion status                                        | Check source `access_decision`, operator status (`GET /api/v1/operator/provider/status`), latest ingestion error, pending candidates and verified polygon count; the source is not fetched automatically |

API errors include a `requestId` and the `X-Request-ID` response header. Use that ID to correlate a problem; avoid logging credentials or private apiary locations.

## `apatch CHK` formatting or worktree drift

`sh ./run-tests.sh` is read-only. If `pnpm format:check` reports style issues,
run `pnpm format` **before** restarting `CHK`; never make `CHK` auto-format files.
Review all formatter changes, including `pnpm-lock.yaml`, before committing.

`python3` may write bytecode to `tools/specs/__pycache__/` unless bytecode is
disabled. The check runner exports `PYTHONDONTWRITEBYTECODE=1`, invokes the SDD
validator with `-B`, and `.gitignore` excludes Python bytecode. A pre-existing
ignored cache file does not establish a source change; inspect and leave tracked
files untouched. If `git diff --check` reports extra blank lines at end-of-file,
correct them before rerunning checks.

When a ZIP has already been applied and `CHK` fails, **do not rerun `APL`**.
Prepare formatting outside `CHK`, then continue with `apatch opSeq=CHK,STS`.
If the current feature branch still contains uncommitted changes from a previous
ZIP and a new repair ZIP must be applied, use the explicitly supported
`followup=true` workflow and verify its branch and overlap warnings first.

## Evidence for a bug report

Record the failing command, redacted environment, HTTP status/error code and request ID, reproducible steps, actual versus expected behavior, and focused test result. For provider issues record source identity, retrieval time, timeout or status and safe response metadata. Do not include raw private data or secret-bearing URLs.

See [CONFIGURATION](CONFIGURATION.md), [USAGE](USAGE.md) and [TESTS](TESTS.md) for configuration, app behavior and checks.
