# Tests and Verification

Run commands from the repository root. Install dependencies as in [Installation](INSTALLATION.md); test execution must not contact live provider APIs or modify real source evidence.

## Canonical checks

Prepare a **local** PostGIS database, apply migrations and install Chromium once:

```bash
docker compose up -d db
pnpm db:migrate
pnpm exec playwright install chromium
sh ./run-tests.sh
```

`run-tests.sh` loads `DATABASE_URL` from the environment or `apps/api/.env`, refuses remote PostgreSQL hosts and fails if prerequisites are missing. It runs, in order:

1. Python `apatch` setup tests and SDD state/link/feature-ID validation.
2. `pnpm format:check`, `pnpm typecheck`, `pnpm test`.
3. Offline Saturn/help-content Node tests and `pnpm build`.
4. `pnpm --dir apps/api test:db` against isolated PostGIS schemas.
5. `pnpm e2e` with desktop and mobile Chromium.

The script is **read-only** with respect to repository source. If formatting fails, run `sh ./run-format.sh` separately, inspect its changes, and rerun checks. Do not use `CHK` to format code. When a check fails, report the failing command, observed error and whether the cause is a product defect, invalid expectation or unavailable environment. A valid failing assertion must not be skipped or weakened.

## Focused checks

| Command                                                                       | Coverage                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm --dir apps/api test`                                                    | Backend unit tests, parsers and transport boundaries (stubbed providers) |
| `pnpm --dir apps/api exec vitest run test/saturnHarCapture.test.ts`           | Bounded offline HAR import, ambiguous/malformed evidence and secrecy     |
| `pnpm --dir apps/api test:db`                                                 | Isolated real-PostGIS migration, persistence and restart cases           |
| `pnpm --dir apps/web test`                                                    | Beekeeper components and HTTP decoding                                   |
| `pnpm --dir apps/admin test`                                                  | Operator components and local workflows                                  |
| `python3 -B tools/specs/validate_state.py`                                    | SDD checkpoint, paths and feature cross-reference                        |
| `node --test scripts/check-saturn-api.test.mjs scripts/help-content.test.mjs` | Offline source diagnostic and localized help fixtures                    |

Focused checks are useful for diagnosis but do **not** replace the canonical runner when full verification is required. Real PostGIS integration tests must use a disposable local database/schema. A green test suite cannot verify upstream API permissions, live availability, source completeness or scientific hazard judgments.

## Playwright UI testing

```bash
pnpm exec playwright install chromium # Once
pnpm e2e
```

The default `playwright.config.ts` starts its **own** Web/Admin Vite servers on ports **5173/5174** and refuses to reuse existing servers. Stop `pnpm dev` before running it. It executes `tests/e2e/map.spec.ts` and `tests/e2e/admin.spec.ts` in **desktop-chromium** and **mobile-chromium** projects. API responses are intercepted with synthetic fixtures, so this suite verifies browser behavior, error/retry paths and mobile layout, **not** API/PostGIS integration. Traces are retained on failures.

For a specific test file or project, use Playwright's standard filters:

```bash
pnpm exec playwright test tests/e2e/admin.spec.ts --project=desktop-chromium
```

For a real API/database-to-browser journey with **synthetic** evidence, run `pnpm e2e:demo`. It starts an isolated `melliatlas_demo_e2e` PostGIS-backed environment and checks both browser sizes. Do not mix it with production credentials or a normal manual provider import.

## Reading the outcome

- **PASS** means the named command exited successfully; record which suites actually ran.
- **FAIL** requires the failing scenario, expected/actual behavior and relevant sanitized logs or Playwright trace.
- **NOT RUN / BLOCKED** must name the missing dependency. Do not describe unavailable PostGIS, Chromium or upstream data checks as passed.

Test evidence never changes developer-controlled [SDD state](specs/STATE.json) by itself. Operational troubleshooting belongs in [Diagnostics](DIAGNOSTIC.md); command shortcuts also appear in [Usage](USAGE.md).
