# Developer Instructions

## Local workflow

1. Use [INSTALLATION](INSTALLATION.md) to prepare dependencies and PostgreSQL.
2. Check the selected [SDD checkpoint](specs/STATE.json) and current [sub-specification](specs/README.md).
3. Identify the owning module in [ARCHITECTURE](ARCHITECTURE.md). Read its `contract.md` and nearest `AGENTS.md` before changing it.
4. Implement a small, independently testable slice. Extend the owning module contract only if its published boundary changes.
5. Run the applicable checks from [TESTS](TESTS.md), run formatting before read-only checks, and update only the documentation that owns changed behavior.
6. Present test evidence and outstanding limitations to the developer. Developer acceptance is required before changing the SDD stage or archiving its sub-spec/plan pair.

## apatch formatting and checks

The repository owns the format/check commands; the external `apatch` utility owns
workflow orchestration. `run-format.sh` runs `pnpm format` and may modify source
files. `run-tests.sh` remains the canonical, read-only `CHK` runner, including
Prettier verification and tests. Do not call formatting from `run-tests.sh`.

The local `.apatch/config.yaml` is Git-ignored and can contain developer-specific
settings. After applying this change on its feature branch, configure it once:

```sh
python3 -B scripts/enable-apatch-fmt.py
```

The bootstrap creates a missing config with schema version 1 and both runners,
or appends missing top-level `format_commands`/`checks` without changing existing
configuration. If `format_commands` already exists without `run-format.sh`, the
script stops without editing: merge the command manually while preserving any
existing commands and settings. If `checks` already exists, it is left untouched;
verify that it still invokes the canonical `run-tests.sh` when desired.

Expected local entries:

```yaml
format_commands:
  - ["sh", "./run-format.sh"]
checks:
  - ["sh", "./run-tests.sh"]
```

For future patches, use `APL,BRN,FMT,CHK` (or `APL,FMT,CHK` for an unfinished
feature branch), followed by the normal developer-controlled Git stages. `FMT`
executes only after switching to the feature branch and before read-only `CHK`.
After a failed `CHK`, resume instead of applying the same ZIP again.

## Ownership conventions

- `apps/api`: API routes, orchestration, source adapters, persistence and credentials.
- `apps/web`: read-only notice/weather map and a separately gated, explicit local Saturn viewport-index pilot; future private apiaries and alerts.
- `apps/admin`: separate local operator UI for sources, bounded ingestion and review. Never expose operator routes without server-side authentication.
- `packages/contracts`: single source of truth for public Zod HTTP schemas.
- `docs/ARCHITECTURE.md`: architecture decisions and module boundaries (no separate ADR index).
- Each module `contract.md`: public API, owned data, dependencies and invariants.
- `docs/FEATURES.md`: durable feature identifiers and shipped/planned status.

Use `docs/specs/active/subspecs/<name>.md` and `<name>-implementation-plan.md` as a pair. The plan should list ordered implementation steps and be refreshed against the current checkout before execution.

## Pull-request scope

Keep FE/BE independently buildable and tested. A public schema change should update the shared contract, API, web consumer and tests in one change set. Do not change an applied migration; add a numbered migration. Do not introduce global helpers merely to share code used by one module.

Patch ZIP and Git/GitHub handling are governed by the developer's external workflow; this repository does not execute that workflow automatically.
