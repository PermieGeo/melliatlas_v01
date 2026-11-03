# Testing and Verification

Run commands from the repository root after [installation](INSTALLATION.md). Format checks and tests must not modify source files.

| Command                                                                     | Purpose                                                                                                                        | External dependency                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `sh ./run-format.sh`                                                        | Prepare Prettier formatting (`FMT`); modifies files and is never a `CHK` command                                               | Installed dependencies                               |
| `python3 -B -m unittest discover -s scripts -p "test_enable_apatch_fmt.py"` | Test non-destructive local apatch configuration setup                                                                          | Python 3 (standard library)                          |
| `pnpm format:check`                                                         | Prettier validation                                                                                                            | Installed dependencies                               |
| `pnpm typecheck`                                                            | Build shared schemas; type-check API, web and admin                                                                            | Installed dependencies                               |
| `pnpm test`                                                                 | API Vitest/Supertest and React component tests                                                                                 | No live provider required; HTTP is stubbed           |
| `pnpm build`                                                                | Production TypeScript/API and both Vite frontend builds                                                                        | Installed dependencies                               |
| `python3 tools/specs/validate_state.py`                                     | Checkpoint, links and feature cross-reference                                                                                  | Python 3 (standard library)                          |
| `python3 tools/feature_context.py WEATHER.POINT_FORECAST`                   | One capability's owners/tests                                                                                                  | Python 3 (standard library)                          |
| `python3 tools/feature_context.py SRC-01`                                   | Features within a delivery stage                                                                                               | Python 3 (standard library)                          |
| `pnpm db:migrate`                                                           | Apply checksummed SQL migrations to PostgreSQL                                                                                 | Running PostGIS database                             |
| `pnpm --dir apps/api test:db`                                               | Run independent real-PostGIS tests covering migrations `001`–`008`, including approval/history and treatment-source revocation | Running PostGIS database and `DATABASE_URL`          |
| `pnpm e2e`                                                                  | Playwright desktop/mobile Chromium browser flows                                                                               | Running PostGIS; installed Chromium browser binaries |

Install browsers once where required:

```bash
pnpm exec playwright install chromium
```

The E2E configuration starts `pnpm dev` automatically (or may reuse an existing server outside CI; stop stale manual instances first). It intercepts source/weather API responses with synthetic test-only fixtures; these are never product fallback data. The API server still requires local PostgreSQL. **Intercepted Playwright tests verify UI behavior, not database/source integration.**

## Test ownership

- API routes and failures: `apps/api/test/app.test.ts`.
- Weather adapter: `apps/api/test/openMeteo.test.ts`.
- Source-ingestion contracts and offline destination policy: `apps/api/test/sourcePolicy.test.ts` (no network/real-source permission evidence).
- Internal approved-registry read mapping and fail-closed behavior: `apps/api/test/municipalSourceRegistry.test.ts`.
- Real migration compatibility, approval constraints, history and policy checks: `apps/api/integration/sourceCatalogMigration.test.ts` (explicit `test:db`, run on CI with PostGIS; tests roll back their temporary schema).
- Provider request building/operator API: `apps/api/test/providerConfiguration.test.ts`, `apps/api/test/app.test.ts`.
- Provider migration/optimistic revision: `apps/api/integration/providerConfigurationMigration.test.ts` (real PostgreSQL, requires DATABASE_URL).
- Provider operator UI: `apps/admin/src/App.test.tsx`; save/configuration must not implicitly collect data.
- Browser components: `apps/web/src/App.test.tsx`.
- Browser response decoding and errors: `apps/web/src/api/client.test.ts`.
- Desktop/mobile map interaction: `tests/e2e/map.spec.ts`; local administrator isolation: `tests/e2e/admin.spec.ts`.
- Worker restart/idempotency, source-adapter fixtures, immutable document persistence and bounded-load tests: **required by SRC-01**, not yet implemented. Migration upgrade has a dedicated PostGIS integration test; unit tests alone do not establish its result.

New behavior needs independently derived positive, negative, boundary and regression tests. Stub providers at network boundaries, not with product fallbacks. Classify failures before changing assertions; never weaken, skip, mock away or silently retry to green. See the [test audit](TEST_AUDIT.md) for gaps.

- Restricted outbound transport: `apps/api/test/httpFetcher.test.ts` uses synthetic public/private DNS answers and injected HTTPS responses; real network/TLS behavior is not established by these fakes.
- Treatment approval migration and revocation: `apps/api/integration/treatmentAccessMigration.test.ts` requires an isolated real PostGIS connection and checks migration `005` after `001`–`004`.
- Provider seed contract and overwrite guards: `apps/api/test/providerSeed.test.ts`; secret-excluding revision snapshots, database seeding and credential reset: `apps/api/integration/providerSeedMigration.test.ts` (real PostGIS, migrations `001`–`008`).

### Useful post-installation sequence

First confirm that PostgreSQL is healthy and migrations are applied, then run independent checks:

```bash
docker compose up -d db
pnpm db:migrate
pnpm format:check
pnpm typecheck
pnpm test
pnpm --dir apps/api test:db
pnpm build
python3 tools/specs/validate_state.py
```

The PostGIS integration tests require `DATABASE_URL` in their process environment. The test script does **not** automatically load `apps/api/.env` in every invocation, so provide a test-only URL explicitly or load a local environment file in the shell without printing secrets. CI supplies `DATABASE_URL` directly. Do not claim `test:db` passed if the database/URL was not available.

Playwright requires a Chromium installation (`pnpm exec playwright install chromium`) and the database; run `pnpm e2e` with the normal dev server stopped to avoid stale sessions. Browser tests with intercepted responses do not establish that real provider retrieval or storage works.

### SRC-01/S3c.1 viewport-query evidence checks

The sanitized `apps/api/test/fixtures/saturn-map-query-*.json` pair records a user-captured single-page viewport search. `scripts/check-saturn-api.test.mjs` validates its exact filter keys, pagination metadata, repeated plan IDs and absence of detailed geometry, and rejects passing the response to the `/planapplybees` diagnostic. `apps/api/test/beekeeperPlanPage.test.ts` rejects the same response from production ingestion while preserving legitimate nullable detailed records. These tests are entirely offline and do **not** certify district IDs, period filters, source-access permission, or completeness. `GET /district-cache` remains read-only and refresh remains disabled pending the separate district evidence gate.

### SRC-01/S3a provider ingestion checks

`apps/api/test/treatmentIngestion.test.ts` checks geometry evidence and negative cases. `apps/api/integration/treatmentIngestion.test.ts` requires a disposable PostGIS database in `DATABASE_URL` and runs migrations 001–008 inside an isolated schema with a stubbed HTTPS fetcher. It verifies configured-source manual fetching, immutable documents, unverified structured polygon visibility, verified/rejected status transitions, exclusion of pending model extraction, deduplication and bbox filtering. Run `pnpm --dir apps/api test:db` after `pnpm db:migrate`. The tests must never access a live provider or use production credentials. Full checks must include formatting, TypeScript, unit tests, build, and Playwright; passing focused tests alone does not prove production readiness or access rights.

## Canonical check runner (`apatch CHK`)

`sh ./run-tests.sh` now runs, in fail-fast order: SDD validation, Prettier check,
TypeScript typecheck, API/web Vitest, production build, **real PostGIS integration
suite** (`apps/api/integration/`), and Playwright E2E. The earlier runner was a
no-op. Integration tests use isolated schemas and local synthetic provider
fixtures; they do not call an external treatment provider.

Prerequisites: install dependencies (`pnpm install --frozen-lockfile`), start the
local PostGIS container (`docker compose up -d db`), apply migrations for the
E2E API (`pnpm db:migrate`), and install Chromium once
(`pnpm exec playwright install chromium`). Set `DATABASE_URL` to the local database,
or create `apps/api/.env` containing it. The runner loads this value via Node.js
22's `process.loadEnvFile` and refuses remote database addresses; it does not
print credentials. A missing database, browser or dependency causes a visible
failure, not a skipped test. It does not change source files or automatically
run formatting preparation.

For `apatch` to invoke the runner, the developer-controlled
`.apatch/config.yaml` must contain `checks` pointing at `sh ./run-tests.sh`.
Inspect the actual `CHK` command output; repository code cannot silently change
local `apatch` configuration. CI also invokes this runner after database
migration and browser installation.

Provider-specific coverage includes `apps/api/test/beekeeperPlanPage.test.ts`
(malformed geometry is retained as text-only evidence),
`apps/api/test/app.test.ts` (local administrator diagnostics and cross-origin refusal),
`apps/api/integration/treatmentIngestion.test.ts` (real PostGIS access,
collection, duplicate handling and publication), and
`apps/web/src/components/ProviderSettings.test.tsx` (visible import status).
No unit or CI test establishes the availability, contract or reuse rights of a
live external API; the only supported live fetch remains explicit and restricted to the loopback administrator API.

### Manual configured treatment feed regressions

`apps/api/test/httpFetcher.test.ts` proves a configured manual treatment source can use the restricted transport, but a merely configured municipal source cannot bypass its separate approval policy. `apps/api/test/app.test.ts` verifies the removed approval route and local token-free one-page sync and cross-origin refusal. `apps/web/src/components/ProviderSettings.test.tsx` verifies that sync is available without credentials and triggered on successful save, with no permission form. The real-PostGIS ingestion test applies migrations 001–008 and uses a stubbed provider response to verify the full raw-document, candidate and verified-publication path. These tests run under the existing `run-tests.sh` / `apatch CHK`; they do not call the live reference provider.

The dependency-free `node --test scripts/check-saturn-api.test.mjs` uses an injected fetcher; it never calls the external service. Run `node scripts/check-saturn-api.mjs` manually for a single live upstream probe when network access is available.

### Provider page parser compatibility (SRC-01/S3a.3)

`apps/api/test/beekeeperPlanPage.test.ts` verifies that null/incorrectly typed optional plan metadata does not discard an otherwise valid polygon, while invalid page envelopes and unbounded pages remain rejected. A live external response is **not** supplied as a test fixture. Run `pnpm --dir apps/api test` to validate the parser change, then run `sh ./run-tests.sh` for all canonical checks. If manual collection still returns `INVALID_SOURCE_RESPONSE`, inspect the local API process for the redacted schema-path diagnostics and capture no raw provider records.

### S3b regional collection and map viewport

`apps/api/test/regionalScanState.test.ts` tests cursor progress and honest terminal state. `apps/api/integration/regionalCollection.test.ts` uses two synthetic provider pages and a disposable PostGIS schema, checking manual/scan exclusion, durable progress, restart, page completion and pause/resume. `apps/api/test/app.test.ts` covers local administrator-only region endpoints. The browser API client tests viewport `bbox` encoding; Playwright intercepts both unfiltered and bbox-qualified public URLs. The canonical `run-tests.sh` executes them; no test calls Saturn or proves a nightly source scan was actually completed.

Migration `010_provider_document_last_seen.sql` adds `last_seen_at` to source documents and is applied by `pnpm db:migrate`; the ingestion integration tests apply migrations 001–010 in their isolated schema. Repeated bytes update only the last-seen timestamp, not the immutable original document payload or original retrieval date. Verify this behavior with real PostGIS; a TS syntax check alone cannot establish it.

S3c foundation: `apps/api/test/districtCacheState.test.ts` covers completion/TTL/filter identity, retained previous completion and malformed progress; `apps/api/integration/districtCache.test.ts` validates migrations 011–012, uniqueness, transactional progress, configuration revision invalidation, concurrent claims, forced refresh, stale-owner rejection and crash recovery. Operator status and disabled refresh assertions are in `apps/api/test/app.test.ts` and `apps/admin/src/App.test.tsx`. A green test suite does not certify the unpublished district HTTP parameters; live district fetch remains gated until real portal evidence is recorded.

### S3c.2 source-wide request pacing

`apps/api/integration/providerRequestThrottle.test.ts` runs with a disposable local PostGIS schema and applies migrations 001 and 013. It checks atomic reservation across distinct repository instances, independent source identities, 65-second reservation persistence over a simulated process restart, expiry recovery, and rejection of unknown source IDs. `apps/api/integration/treatmentIngestion.test.ts` now includes migration 013 and verifies that a second manual request receives `SOURCE_THROTTLED` (HTTP 429) **before** hitting the injected provider transport. Its unrelated evidence/review regression uses an explicit permissive request gate; the separate real-PostgreSQL tests establish pacing behavior. `run-tests.sh` includes both suites through `test:db` after the local database and dependencies are available. No live upstream requests occur. Database pacing does not apply to the standalone `scripts/check-saturn-api.mjs` diagnostic and does not authorize district fetching; real district filters remain unverified.
