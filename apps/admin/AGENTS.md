# Operator Web Engineering Guidance

Extends [root engineering guidance](../../AGENTS.md). This is the separate **React/TypeScript** operator application.

- Keep source configuration, explicit collection, pending-evidence preview, review decisions and diagnostics within `apps/admin`; do not share operator UI or privileged API calls with `apps/web`.
- Organize components and state by operator task. Keep `src/App.tsx` a composition point; use existing API-client boundaries and `@melliatlas/contracts` rather than duplicating schemas or embedding provider parsing in components.
- Saving a source configuration must not silently start collection. Distinguish configured, running, partial, failed and reviewed states and display trustworthy persisted progress.
- The current loopback/origin restrictions are **not production authentication**. Do not expose operator actions to remote users without real server-side identity and authorization.
- Fetch from the backend, not directly from Saturn or PostGIS. Never bundle access keys or raw protected source documents into the client.
- Label uncertain and pending geometry as unverified; keep source attribution and avoid risk claims. Localize all authored UI text via existing RU/EN catalogs.
- Use component/browser tests for operator-only access, explicit actions, async failures, stale responses, keyboard interaction and responsive screens.
