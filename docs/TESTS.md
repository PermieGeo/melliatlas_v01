# Testing and Verification

Run commands from the repository root after [installation](INSTALLATION.md). Format checks and tests must not modify source files.

| Command                                                   | Purpose                                                                                                                        | External dependency                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `pnpm format:check`                                       | Prettier validation                                                                                                            | Installed dependencies                               |
| `pnpm typecheck`                                          | Build shared schemas; type-check API and web                                                                                   | Installed dependencies                               |
| `pnpm test`                                               | API Vitest/Supertest and React component tests                                                                                 | No live provider required; HTTP is stubbed           |
| `pnpm build`                                              | Production TypeScript/API and Vite/web builds                                                                                  | Installed dependencies                               |
| `python3 tools/specs/validate_state.py`                   | Checkpoint, links and feature cross-reference                                                                                  | Python 3 (standard library)                          |
| `python3 tools/feature_context.py WEATHER.POINT_FORECAST` | One capability's owners/tests                                                                                                  | Python 3 (standard library)                          |
| `python3 tools/feature_context.py SRC-01`                 | Features within a delivery stage                                                                                               | Python 3 (standard library)                          |
| `pnpm db:migrate`                                         | Apply checksummed SQL migrations to PostgreSQL                                                                                 | Running PostGIS database                             |
| `pnpm --dir apps/api test:db`                             | Run independent real-PostGIS tests covering migrations `001`–`006`, including approval/history and treatment-source revocation | Running PostGIS database and `DATABASE_URL`          |
| `pnpm e2e`                                                | Playwright desktop/mobile Chromium browser flows                                                                               | Running PostGIS; installed Chromium browser binaries |

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
- Provider operator UI: `apps/web/src/components/ProviderSettings.test.tsx`.
- Browser components: `apps/web/src/App.test.tsx`.
- Browser response decoding and errors: `apps/web/src/api/client.test.ts`.
- Desktop/mobile map interaction: `tests/e2e/map.spec.ts`.
- Worker restart/idempotency, source-adapter fixtures, immutable document persistence and bounded-load tests: **required by SRC-01**, not yet implemented. Migration upgrade has a dedicated PostGIS integration test; unit tests alone do not establish its result.

New behavior needs independently derived positive, negative, boundary and regression tests. Stub providers at network boundaries, not with product fallbacks. Classify failures before changing assertions; never weaken, skip, mock away or silently retry to green. See the [test audit](TEST_AUDIT.md) for gaps.

- Restricted outbound transport: `apps/api/test/httpFetcher.test.ts` uses synthetic public/private DNS answers and injected HTTPS responses; real network/TLS behavior is not established by these fakes.
- Treatment approval migration and revocation: `apps/api/integration/treatmentAccessMigration.test.ts` requires an isolated real PostGIS connection and checks migration `005` after `001`–`004`.
- Provider seed contract and overwrite guards: `apps/api/test/providerSeed.test.ts`; secret-excluding revision snapshots, database seeding and credential reset: `apps/api/integration/providerSeedMigration.test.ts` (real PostGIS, migrations `001`–`006`).

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

### SRC-01/S3a provider ingestion checks

`apps/api/test/treatmentIngestion.test.ts` checks geometry evidence and negative cases. `apps/api/integration/treatmentIngestion.test.ts` requires a disposable PostGIS database in `DATABASE_URL` and runs migrations 001–007 inside an isolated schema with a stubbed HTTPS fetcher. It verifies approval gating, immutable documents, review-only publication, deduplication and bbox filtering. Run `pnpm --dir apps/api test:db` after `pnpm db:migrate`. The tests must never access a live provider or use production credentials. Full checks must include formatting, TypeScript, unit tests, build, and Playwright; passing focused tests alone does not prove production readiness or access rights.
