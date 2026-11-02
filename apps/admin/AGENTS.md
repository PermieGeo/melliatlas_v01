# Administrator Frontend Rules

Extends [repository rules](../../AGENTS.md).

- All operator settings, ingestion requests, pending evidence and review actions belong to `apps/admin`; never import them into `apps/web`.
- This local-only frontend is **not** an authentication boundary. Never expose the operator API or admin frontend beyond loopback without server-side administrator authentication.
- Persisted configuration edits must never silently trigger external collection. Distinguish configuration, collection and record verification in the UI.
- Keep user-visible text in message catalogs and provide independent source error, loading, partial and empty states.
- Browser network requests use `@melliatlas/contracts` schemas when available and the backend API; no direct third-party calls, database connections or stored access keys.
- Treat pending geometry as an explicitly labelled preview, not public data or a pesticide risk determination.
