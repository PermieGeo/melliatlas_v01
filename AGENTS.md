# MelliAtlas Repository Instructions

Applies to the monorepo. Nested `AGENTS.md` files **extend** these rules; they do not replace them.

## Before changing code

1. Read [README.md](README.md), [architecture](docs/ARCHITECTURE.md), [SDD index](docs/specs/README.md), [SDD checkpoint](docs/specs/STATE.json), the selected sub-spec and its current implementation plan.
2. Read the `AGENTS.md` in every affected subtree. Inspect code and relevant tests before assuming a behavior exists.
3. Respect the selected stage in `STATE.json`. Regenerate/reconcile the linked implementation plan against the current source at each new stage or significant resumption.

## Architecture boundaries

- `apps/web` owns display and browser interaction. It communicates with `apps/api` through the versioned HTTP API only.
- `apps/api` owns external credentials, source retrieval, validation, provenance, geospatial computations and persistence.
- `packages/contracts` holds versioned wire-level schemas/types. It must never import either application or access the database/network.
- Prefer a modular backend monolith over premature service splitting. Keep source-specific adapters behind explicit contracts.
- No frontend import from backend implementation, no API import from frontend implementation, and no shared mutable state between workspaces.

## Data integrity and privacy

- Never invent observations, fields, apiaries, forecasts, official notices, source confidence scores or model verdicts for a live screen or API.
- Never silently fall back to fabricated data on failed source requests. Surface source identity, retrieval time, coverage, freshness, review status and errors.
- Treat external announcements and model output as **untrusted evidence**. Validate schema, attribution and spatial precision; require human review for uncertain or high-impact facts.
- Do not present estimated pesticide drift, blooming or spraying windows as scientifically validated or legally safe without an explicit, validated methodology.
- Precise apiary locations are private. Never include them in public maps, source logs, telemetry, prompts or error payloads.
- Never commit credentials, real personal data, downloaded private datasets or local `.env` files.

## Engineering gates

- Code/config comments and all repository documentation must be in English. The customer-facing UI may be in Russian.
- Make small cohesive, independently testable increments; record requirements and their evidence.
- Add positive, negative, boundary, provider-failure, retry/idempotency and restart tests where appropriate; include browser E2E and API contract tests for user-facing changes.
- `format:check`, `typecheck`, tests, build, SDD validation and migrations are independent gates. No gate may modify code as a side effect.
- Only the developer accepts a completed scope; implementation, ZIP creation, CI success or a PR merge does not imply acceptance.

## SDD layout

- Umbrella: `docs/specs/active/spec-melliatlas-mvp.md`.
- Selected normative child: `docs/specs/active/subspecs/source-ingestion.md`.
- Selected advisory implementation plan: `docs/specs/active/source-ingestion-implementation-plan.md`.
- Current checkpoint: `docs/specs/STATE.json`.
- Completed work is archived **as a spec-and-plan pair**, and only after explicit developer acceptance.

See [specification agent instructions](docs/specs/AGENTS.md) for the lifecycle.
