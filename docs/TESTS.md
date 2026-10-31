# Testing and Verification

Run commands from the repository root after [installation](INSTALLATION.md). Format checks and tests must not modify source files.

| Command                                                   | Purpose                                          | External dependency                                  |
| --------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `pnpm format:check`                                       | Prettier validation                              | Installed dependencies                               |
| `pnpm typecheck`                                          | Build shared schemas; type-check API and web     | Installed dependencies                               |
| `pnpm test`                                               | API Vitest/Supertest and React component tests   | No live provider required; HTTP is stubbed           |
| `pnpm build`                                              | Production TypeScript/API and Vite/web builds    | Installed dependencies                               |
| `python3 tools/specs/validate_state.py`                   | Checkpoint, links and feature cross-reference    | Python 3 (standard library)                          |
| `python3 tools/feature_context.py WEATHER.POINT_FORECAST` | One capability's owners/tests                    | Python 3 (standard library)                          |
| `python3 tools/feature_context.py SRC-01`                 | Features within a delivery stage                 | Python 3 (standard library)                          |
| `pnpm db:migrate`                                         | Apply checksummed SQL migrations to PostgreSQL   | Running PostGIS database                             |
| `pnpm e2e`                                                | Playwright desktop/mobile Chromium browser flows | Running PostGIS; installed Chromium browser binaries |

Install browsers once where required:

```bash
pnpm exec playwright install chromium
```

The E2E configuration starts `pnpm dev` automatically. It intercepts source/weather API responses with synthetic test-only fixtures; these are never product fallback data. The API server still requires local PostgreSQL. **Intercepted Playwright tests verify UI behavior, not database/source integration.**

## Test ownership

- API routes and failures: `apps/api/test/app.test.ts`.
- Weather adapter: `apps/api/test/openMeteo.test.ts`.
- Source-ingestion contracts and offline destination policy: `apps/api/test/sourcePolicy.test.ts` (no network/real-source permission evidence).
- Browser components: `apps/web/src/App.test.tsx`.
- Browser response decoding and errors: `apps/web/src/api/client.test.ts`.
- Desktop/mobile map interaction: `tests/e2e/map.spec.ts`.
- Database integration, worker restart/idempotency, source-adapter fixtures, migration upgrade and bounded-load tests: **required by SRC-01**, not yet present in the bootstrap.

New behavior needs independently derived positive, negative, boundary and regression tests. Stub providers at network boundaries, not with product fallbacks. Classify failures before changing assertions; never weaken, skip, mock away or silently retry to green. See the [test audit](TEST_AUDIT.md) for gaps.
