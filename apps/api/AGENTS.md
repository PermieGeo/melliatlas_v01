# API Engineering Guidance

Extends [root engineering guidance](../../AGENTS.md). Applies to the Node.js/TypeScript/Express backend; use [ARCHITECTURE](../../docs/ARCHITECTURE.md) and the owning module's `contract.md` for current boundaries.

## Modules and dependency direction

- Keep the API a **modular monolith** under `src/modules/<capability>/`. Business use cases should remain independent of Express requests/responses, database drivers and specific upstream HTTP clients wherever practical.
- `src/app.ts` and `src/server.ts` compose routes and dependencies; handlers validate/translate requests and delegate behavior. Avoid turning composition files or HTTP handlers into domain modules.
- Access another capability through its documented public entry point. Do not import its private adapters or query tables owned by another capability. Keep source-specific behavior in provider modules, not generic transport or `common/`.
- Use explicit dependency injection for external clients, persistence and clocks where it materially improves testability. Do not manufacture interfaces, repositories or managers solely to imitate a framework.
- Keep source and PostGIS data ownership explicit. `src/db/` provides infrastructure; the owning capability defines business persistence rules. Update meaningful module contracts when boundaries change.

## API contracts and reliability

- `packages/contracts` owns public `/api/v1` request/response schemas. Validate incoming payloads, provider data and outgoing wire values at their boundaries; do not expose persistence models directly.
- Translate implementation failures to stable, sanitized API codes. Preserve source IDs, revisions, original references, retrieval/publication timestamps, geometry precision and human review decisions; unknown is not safe.
- Make external retrieval restricted and bounded: approved HTTPS destinations, DNS/IP and redirect protection, payload/time limits, shared provider pacing and explicit cancellation/retry behavior. Never let upstream content or AI output select arbitrary URLs, SQL or privileged tools.
- Keep credentials, raw protected provider data and precise private apiary coordinates out of logs, diagnostics and public responses.
- Use additive database migrations; never rewrite an applied migration. Make collection and persistence idempotent and restart-safe when those behaviors are required.

## Verification focus

- Test module logic independently of HTTP, then test route validation and authorization boundaries. Use deterministic provider fakes and isolated real-PostGIS tests for transactions, migrations and restart behavior; mocks alone cannot establish database invariants.
