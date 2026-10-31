# ADR-0001 — Monorepo with Separately Deployable TypeScript Applications

**Status:** Accepted as the bootstrap technical baseline (2026-10-31); product stages remain unaccepted.

## Decision

Use a pnpm monorepo containing `apps/api`, `apps/web`, `packages/contracts`, tests and shared SDD documentation. The API starts on Node.js/TypeScript with Express and PostgreSQL/PostGIS. The web app starts on React/Vite/Tailwind/Leaflet as a responsive browser app. Add a mobile shell only after mobile browser usability is measured. Keep Rust an option for a separately benchmarked geospatial/satellite compute component.

## Rationale

- One issue/PR/SDD feature ID can cover a complete end-to-end change without cross-repository release coordination.
- Explicit package boundaries preserve independent application testing, versioned HTTP contracts and separate deployments.
- Existing prototype UI and source-integration patterns can be carried forward quickly in TypeScript.
- Node.js is suitable for predominantly I/O-bound provider collection and LLM calls; PostGIS owns indexed spatial operations. Rust does not solve provider access, data quality or scientific validation problems.

## Consequences

- Shared contract changes require a contracts build before API/web typecheck or production build.
- A worker is deployed as a separate process when ingestion starts, while reusing the API's domain modules.
- No direct database access from the browser; all credentials are server-side.
- The repository keeps one SDD processing checkpoint and separate subtree `AGENTS.md` instructions.
