# Testing and Verification

Run commands from the repository root after [installation](INSTALLATION.md). Format checks and tests must not modify source files.

| Command                                   | Purpose                                          | External dependency                                  |
| ----------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `pnpm format:check`                       | Prettier validation                              | Installed dependencies                               |
| `pnpm typecheck`                          | Build shared schemas; type-check API and web     | Installed dependencies                               |
| `pnpm test`                               | API Vitest/Supertest and React component tests   | No live provider required; HTTP is stubbed           |
| `pnpm build`                              | Production TypeScript/API and Vite/web builds    | Installed dependencies                               |
| `python3 tools/specs/validate_state.py`   | Selected stage, spec/plan links, feature index   | Python 3                                             |
| `python3 tools/feature_context.py SRC-01` | Display indexed implementation/test ownership    | Python 3                                             |
| `pnpm db:migrate`                         | Apply checksummed SQL migrations to PostgreSQL   | Running PostGIS database                             |
| `pnpm e2e`                                | Playwright desktop/mobile Chromium browser flows | Running PostGIS; installed Chromium browser binaries |

Install browsers once where required:

```bash
pnpm exec playwright install chromium
```

The E2E configuration starts `pnpm dev` automatically. It intercepts source/weather API responses with explicitly synthetic test fixtures; these are test-only and are never product fallback data. The API server still requires a real local PostgreSQL database for startup.

## Test ownership

- API routes and failures: `apps/api/test/app.test.ts`.
- Weather adapter: `apps/api/test/openMeteo.test.ts`.
- Browser components: `apps/web/src/App.test.tsx`.
- Desktop/mobile map interaction: `tests/e2e/map.spec.ts`.
- Database integration, worker restart/idempotency, source-adapter fixtures, migration upgrade and bounded-load tests: **required by SRC-01**, not yet present in the bootstrap.

New behavior needs independently meaningful positive, negative, boundary and regression tests. External providers should be mocked at the network adapter boundary, not through production data substitutions. Test failures remain open until fixed or explicitly shown to contradict the requirement.
