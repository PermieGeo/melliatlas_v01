# Diagnostics and Troubleshooting

Start with the failing command, HTTP status, API `requestId` / `X-Request-ID`, the affected service and the time of failure. Do not print credentials, unredacted provider payloads or private apiary locations. For installation prerequisites, see [Installation](INSTALLATION.md).

## Installation and startup

| Symptom                                              | Verify                                                              | Recovery                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm: command not found` / unsupported Node version | `node --version`, `npm --version`, `pnpm --version`                 | Select Node.js 22 (`nvm use 22` where available), install the pinned pnpm 11.25.0 in the active shell                            |
| Docker daemon unavailable                            | `docker info`, `docker compose version`                             | Start Docker Desktop, Colima or the Linux engine; on WSL enable Ubuntu integration                                               |
| PostGIS unhealthy                                    | `docker compose ps`, `docker compose logs --tail=80 db`             | Resolve container/port errors and wait for healthy state before migrations                                                       |
| Database rejects the password                        | Local `DATABASE_URL`, original Compose database initialization      | Match credentials in the **existing** persistent volume; changing Compose environment does not reset an existing user's password |
| `API startup failed` / readiness 503                 | `apps/api/.env`, `DATABASE_URL`, `pnpm db:migrate`, `/health/ready` | Confirm the host database port is **5433** and apply pending migrations; do not edit applied migration checksums                 |
| Vite proxy `ECONNREFUSED 127.0.0.1:3001`             | API terminal, `/health/live`                                        | Restart the failed API; do not start an extra API alongside `pnpm dev`                                                           |
| Port conflict on 3001/5173/5174/5433                 | Existing dev processes and host port listeners                      | Stop the conflicting process; Playwright requires free frontend ports                                                            |

To isolate backend startup, stop the root `pnpm dev` command first and then run `pnpm --dir apps/api dev`. Never run both copies simultaneously.

### Blocked pnpm dependency builds

The pinned `pnpm` version may reject an unexpected installation script. If `esbuild` is explicitly reported as blocked, verify the local `pnpm-workspace.yaml` approval before changing it. If approval is genuinely missing:

```bash
pnpm approve-builds esbuild
pnpm rebuild esbuild
pnpm install --frozen-lockfile
```

In an interactive approval menu, **Space** selects a package and **Enter** confirms. Enter alone can record a rejection. The repository already tracks `allowBuilds` approval for `esbuild`; do not approve other dependencies indiscriminately or overwrite the workspace configuration without review.

## Application and source diagnostics

| Symptom                                      | Check                                                                | Interpretation or action                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Weather/tiles unavailable                    | Browser Network, Open-Meteo/OSM connectivity and timeout             | Show the real error; never synthesize observations                                                   |
| Invalid coordinates                          | WGS84: latitude −90…90, longitude −180…180                           | Correct request; invalid inputs yield a typed error                                                  |
| Empty map or missing notices                 | Backend readiness, `GET /api/v1/notices`, local source evidence      | A clean empty view is **not** evidence of no treatments or safety                                    |
| Admin 403                                    | Browser `Origin`, loopback address                                   | Use local Admin port **5174**. Origin checks are not production authentication                       |
| Admin 503 or settings 409                    | API/database health, configuration revision                          | Apply migrations or reload current settings before editing again                                     |
| `INVALID_SOURCE_RESPONSE`                    | Redacted parser issue paths, upstream envelope and source settings   | Investigate provider format without logging records; invalid geometry stays non-public text evidence |
| Nothing appears after configuring a provider | Explicit ingestion status and review state                           | **Saving settings does not fetch**; start a bounded manual collection separately                     |
| Saturn disabled / `SOURCE_THROTTLED`         | `SATURN_VIEWPORT_LIVE_ENABLED`, local request audit, shared cooldown | Verify source rights, enable only intentional local fetching, then wait for the rate-limited slot    |
| Playwright cannot start                      | Chromium installation and Vite ports                                 | `pnpm exec playwright install chromium`; stop `pnpm dev` before `pnpm e2e`                           |

Saturn index centers and cached district names do not establish treatment geometry, complete district coverage or safe application dates. For source identity and unresolved external contracts, consult the [evidence register](source-register.md). For offline capture inspection, `pnpm --dir apps/api evidence:saturn -- --help` lists accepted flags; it does not contact Saturn. A standalone manual connectivity probe is `node scripts/check-saturn-api.mjs` and must not be mistaken for authorization to collect data.

## Formatting and `apatch` recovery

`sh ./run-format.sh` **modifies files**; `sh ./run-tests.sh` is the canonical read-only check. If `pnpm format:check` fails, format and inspect the working tree before running `CHK` again. When `apatch` already applied a ZIP and `CHK` fails, resume with `apatch opSeq=CHK,STS` after fixing the issue; **do not reapply `APL`**. `followup=true` is only for a repair ZIP on an unfinished feature branch.

When reporting a defect, include steps, expected/actual result, failing command, sanitized status/code and request ID, and the focused test result. Distinguish a blocked environment from a product failure. See [Tests](TESTS.md) for Playwright traces and verification criteria.
