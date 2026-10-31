# Quality Policy

The repository currently uses TypeScript strict compilation, Zod boundary validation, Prettier, Vitest, Playwright and an SDD checkpoint validator.

## Required gates

- Run `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `python3 tools/specs/validate_state.py` for changes that affect shared contracts or repository documentation structure.
- Run focused tests first. Add database migrations and Playwright gates when the modified behavior crosses those boundaries.
- Keep `CHK`-equivalent checks read-only; perform `pnpm format` separately when explicitly preparing files for verification.
- An assertion that fails against a valid requirement is a defect; never skip, weaken or delete it solely to reach green.
- Record which gates were executed. A build is not evidence of live source permissions, scientifically valid risk analysis or user acceptance.

## Scope and architecture checks

- New modules require a root `contract.md`, clear API boundaries and no dependency cycles.
- Public HTTP schema changes require matching FE/BE validation and regression tests.
- New SQL migrations are additive and retain checksums; test both fresh and upgrade paths.
- Use deterministic local provider fixtures for tests. Do not require production credentials or live external websites.
- Treat provider errors, retries, stale data, privacy leaks and accessible mobile presentation as first-class regression cases.

Coverage targets, dependency scanning and architectural automation should be introduced with real tooling and a measured baseline; no numeric target is currently enforced.
