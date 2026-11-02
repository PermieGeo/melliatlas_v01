# MelliAtlas Administrator UI

This is a separate React/Vite application for **local-only** source administration. Start it with `pnpm dev` from the repository root and visit `http://127.0.0.1:5174`.

It uses the same backend and PostgreSQL/PostGIS database as the beekeeper client. Configuration saving, restricted one-page collection, evidence review and unverified geometry preview are distinct operations. The current collector is not a complete regional sync worker.

**Security:** The API is loopback-bound and the browser origin check blocks ordinary cross-origin access. There is no remotely enforced administrator identity yet. Never publish `apps/admin` or `/api/v1/operator/*` via a reverse proxy or public network until server-side authentication and authorization are delivered.
