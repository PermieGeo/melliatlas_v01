# Developer Instructions

## Local workflow

1. Use [INSTALLATION](INSTALLATION.md) to prepare dependencies and PostgreSQL.
2. Check the selected [SDD checkpoint](specs/STATE.json) and current [sub-specification](specs/README.md).
3. Identify the owning module in [ARCHITECTURE](ARCHITECTURE.md). Read its `contract.md` and nearest `AGENTS.md` before changing it.
4. Implement a small, independently testable slice. Extend the owning module contract only if its published boundary changes.
5. Run the applicable checks from [TESTS](TESTS.md), verify formatting separately, and update only the documentation that owns changed behavior.
6. Present test evidence and outstanding limitations to the developer. Developer acceptance is required before changing the SDD stage or archiving its sub-spec/plan pair.

## Ownership conventions

- `apps/api`: API routes, orchestration, source adapters, persistence and credentials.
- `apps/web`: responsive user experience, browser state, map layers and API client.
- `packages/contracts`: single source of truth for public Zod HTTP schemas.
- `docs/ARCHITECTURE.md`: architecture decisions and module boundaries (no separate ADR index).
- Each module `contract.md`: public API, owned data, dependencies and invariants.
- `docs/FEATURES.md`: durable feature identifiers and shipped/planned status.

Use `docs/specs/active/subspecs/<name>.md` and `<name>-implementation-plan.md` as a pair. The plan should list ordered implementation steps and be refreshed against the current checkout before execution.

## Pull-request scope

Keep FE/BE independently buildable and tested. A public schema change should update the shared contract, API, web consumer and tests in one change set. Do not change an applied migration; add a numbered migration. Do not introduce global helpers merely to share code used by one module.

Patch ZIP and Git/GitHub handling are governed by the developer's external workflow; this repository does not execute that workflow automatically.
