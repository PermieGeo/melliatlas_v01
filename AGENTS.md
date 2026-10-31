# MelliAtlas Repository Rules

Applies to the monorepo. Nearest nested `AGENTS.md` files extend these rules and cannot weaken them.

## Source of truth

1. Current code, Zod schemas, migrations and executable tests define existing behavior.
2. [Architecture](docs/ARCHITECTURE.md) and module `contract.md` files define boundaries and ownership.
3. [Active specifications](docs/specs/README.md) define intended behavior. Implementation plans are advisory.
4. [STATE.json](docs/specs/STATE.json) is a developer-controlled selection checkpoint, not acceptance evidence.

Before changes, read the owning module's `contract.md`, nearest `AGENTS.md`, selected spec/plan and relevant tests. Read a collaborating module's contract before inspecting its internals.

## Module boundaries and DRY

- Organize by cohesive **capability**, not global controller/service/repository layers. Each functional module owns its behavior, adapters, persistence access, tests and published API.
- Every functional module MUST have a concise `contract.md` in its root: purpose, public entry points, owned data, allowed dependencies, forbidden access, invariants and extension points. Link to source; do not duplicate signatures.
- Keep modules acyclic. Call another module through its documented public entry point; never import another module's private adapter or access its privately owned tables.
- `apps/api/src/app.ts` and `server.ts` compose the backend and HTTP routes; `apps/web/src/App.tsx` composes the UI. Keep business rules outside composition roots.
- `apps/web` talks to `apps/api` only via `/api/v1`. `packages/contracts` owns public Zod wire schemas and imports neither application.
- Apply **DRY to behavior and contracts**: one owner for each rule/schema/normalizer. Extract shared logic only after genuine reuse; never create a generic framework for one caller. Keep domain-specific helpers in the owning module.
- Add a new public API, dependency, data owner or module only with an explicit requirement and updated `contract.md`; avoid speculative microservices.

## Implementation discipline

- Make the smallest coherent change. Do not refactor unrelated areas or introduce unverified dependencies.
- Keep code comments, configuration comments, tests' descriptions, specifications and **all software documentation strictly in English**. User-facing UI copy may be localized.
- Validate inputs and external data at boundaries; translate failures to typed, non-leaking responses. Do not expose persistence records over HTTP.
- Preserve source URL, timestamps, provenance, uncertainty, revision and human-review state. Never present synthetic observations as real evidence.
- Protect private apiary coordinates, credentials and raw private source data. Untrusted pages and LLM output never grant network, SQL or execution privileges.
- Keep migrations additive and immutable after application. Bounded retries, idempotency and restart behavior require tests.
- Tests must independently cover positive, negative, boundary and regression behavior; use local provider stubs and controlled clocks. Do not weaken tests to obtain PASS.
- Run focused tests, then the relevant checks from [TESTS.md](docs/TESTS.md). Formatting is a separate step; check commands must not edit files.
- Do not change acceptance/archive state without explicit developer approval; never imply Git/PR/deployment operations were performed.

## Documentation ownership

| Concern                          | Canonical document                       |
| -------------------------------- | ---------------------------------------- |
| Repository overview              | [README.md](README.md)                   |
| Developer workflow               | [INSTRUCTIONS](docs/INSTRUCTIONS.md)     |
| Local setup and platforms        | [INSTALLATION](docs/INSTALLATION.md)     |
| App use and API examples         | [USAGE](docs/USAGE.md)                   |
| Implemented and planned features | [FEATURES](docs/FEATURES.md)             |
| Architecture and module graph    | [ARCHITECTURE](docs/ARCHITECTURE.md)     |
| Current wiring                   | [IMPLEMENTATION](docs/IMPLEMENTATION.md) |
| Environment variables            | [CONFIGURATION](docs/CONFIGURATION.md)   |
| Tests and commands               | [TESTS](docs/TESTS.md)                   |
| Quality policy                   | [QUALITY](docs/QUALITY.md)               |
| Troubleshooting                  | [DIAGNOSTIC](docs/DIAGNOSTIC.md)         |
| Priorities                       | [ROADMAP](docs/ROADMAP.md)               |
| SDD structure and checkpoint     | [specs/README](docs/specs/README.md)     |
| Module boundary                  | Nearest `contract.md`                    |

Keep information in its owning document; link instead of copying long sections.

## SDD

- Umbrella: `docs/specs/active/spec-umbrella-melliatlas.md`.
- Selected normative child: `docs/specs/active/subspecs/source-ingestion.md`.
- Linked advisory plan: `docs/specs/active/subspecs/source-ingestion-implementation-plan.md`.
- One selected workstream: `docs/specs/STATE.json`. Refresh the plan against current sources before implementation.
- Archive a completed child **with its plan** only after developer acceptance.
- See [specification rules](docs/specs/AGENTS.md).
