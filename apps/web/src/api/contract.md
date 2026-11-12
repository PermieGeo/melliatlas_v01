# Beekeeper HTTP Client

**Owner:** `apps/web/src/api/`. **Public API:** `client.ts` exports validated `@melliatlas/contracts` responses.

- `GET /api/v1/notices?bbox=...` reads only previously persisted, source-attributed PostGIS treatment polygons (at most 200 per response); `GET /api/v1/locations/inspect` reads a weather inspection.
- `GET /api/v1/territories/regions` and `GET /api/v1/territories/districts?regionId=...` are read-only saved navigation catalogs, not geographic boundary/filter APIs. Region IDs are local navigation keys with private provider-code mappings. District IDs come from previously cached directories; they are not boundary IDs.
- Errors are parsed without leaking source bodies; empty catalogs, failed reads and empty treatment layers are separate states.
- Web never invokes `/api/v1/operator/*` or `/api/v1/map/saturn-viewport/*`; fetching, directory refresh and all source diagnostics belong to Admin.
