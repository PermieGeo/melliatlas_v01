# Backend Rules

Extends [root AGENTS.md](../../AGENTS.md).

- Backend is a modular monolith. Functional modules belong under `src/modules/<capability>/` and MUST contain `contract.md`. New modules own their use cases, provider adapters, persistence ports, tests and public interfaces.
- Only `src/app.ts` and `src/server.ts` compose HTTP routes and dependencies. Keep routes thin; no domain logic or provider-specific parsing in handlers.
- A consumer may use a peer module's **documented public API only**. No cross-module internal imports or private table access; no circular dependencies.
- `src/db/` is infrastructure, with its own `contract.md`. Domain SQL and ownership rules must be explicit when new capabilities are introduced.
- `packages/contracts` is the sole owner of cross-app HTTP schemas. Validate inbound requests, provider payloads and outgoing wire data at relevant boundaries. Do not duplicate schemas across modules.
- Preserve source IDs, timestamps, original URLs, source versions, extraction state and run outcomes. Unknown facts remain unknown.
- External retrieval requires approved hosts, redirect/DNS/IP protection, payload caps, timeouts, rate limits, bounded retries and idempotent storage.
- Source text and model output are untrusted. The future AI agent must use explicit allowlisted tools, strict outputs, evidence links and review gates.
- Keep credentials, provider keys and private apiary coordinates outside responses, URLs where inappropriate, logs, prompts and fixtures.
- Never mutate applied SQL migrations; add new numbered migrations and prove upgrade/restart behavior.
- Prefer dependency injection and deterministic adapters. Test success, malformed input, network failures, duplicate runs and restart paths. Stub repositories cannot prove real PostGIS transaction and migration invariants; test those against an isolated database. Never weaken a valid assertion for a green check.
- All documentation and comments are English. Check [CONFIGURATION](../../docs/CONFIGURATION.md), [TESTS](../../docs/TESTS.md) and the relevant module contract before editing.
