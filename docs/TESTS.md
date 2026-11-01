# Testing and Verification

Run commands from the repository root after [installation](INSTALLATION.md). Format checks and tests must not modify source files.

| Command                                                   | Purpose                                                                                                         | External dependency                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `pnpm format:check`                                       | Prettier validation                                                                                             | Installed dependencies                               |
| `pnpm typecheck`                                          | Build shared schemas; type-check API and web                                                                    | Installed dependencies                               |
| `pnpm test`                                               | API Vitest/Supertest and React component tests                                                                  | No live provider required; HTTP is stubbed           |
| `pnpm build`                                              | Production TypeScript/API and Vite/web builds                                                                   | Installed dependencies                               |
| `python3 tools/specs/validate_state.py`                   | Checkpoint, links and feature cross-reference                                                                   | Python 3 (standard library)                          |
| `python3 tools/feature_context.py WEATHER.POINT_FORECAST` | One capability's owners/tests                                                                                   | Python 3 (standard library)                          |
| `python3 tools/feature_context.py SRC-01`                 | Features within a delivery stage                                                                                | Python 3 (standard library)                          |
| `pnpm db:migrate`                                         | Apply checksummed SQL migrations to PostgreSQL                                                                  | Running PostGIS database                             |
| `pnpm --dir apps/api test:db`                             | Upgrade from SQL 001 through 003 and verify approval/history constraints against a real transactional PostGIS schema | Running PostGIS database and `DATABASE_URL`          |
| `pnpm e2e`                                                | Playwright desktop/mobile Chromium browser flows                                                                | Running PostGIS; installed Chromium browser binaries |

Install browsers once where required:

```bash
pnpm exec playwright install chromium
```

The E2E configuration starts `pnpm dev` automatically. It intercepts source/weather API responses with synthetic test-only fixtures; these are never product fallback data. The API server still requires local PostgreSQL. **Intercepted Playwright tests verify UI behavior, not database/source integration.**

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
