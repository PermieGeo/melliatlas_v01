# MelliAtlas Architecture

## Shape and deployment

MelliAtlas starts as one repository with **separately buildable and deployable applications**. Node.js/TypeScript is the initial API runtime for rapid integration, while Rust remains an optional future choice for isolated CPU-intensive image/geospatial analysis if profiling justifies it.

| Component            | Technology                                                     | Boundary                                                                                               |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `apps/web`           | React 19, Vite, Tailwind CSS 4, Leaflet                        | Read-only attributed treatment map with explicit review status and weather                             |
| `apps/admin`         | React 19, Vite, Tailwind CSS 4, Leaflet                        | Local operator settings, manual collection, source review and pending geometry previews                |
| `apps/api`           | Node.js 22, TypeScript, Express                                | Authenticated integration gateway, validation, provenance, source jobs, AI orchestration               |
| `packages/contracts` | Zod, TypeScript                                                | Versioned `/api/v1` JSON schemas                                                                       |
| Database             | PostgreSQL 16 + PostGIS 3                                      | Source metadata, ingest runs, normalized observations, indexed geometries and private application data |
| Background workers   | Dedicated Node.js process (planned in `SRC-01`)                | Scheduled fetch, parsing, normalization and idempotent persistence                                     |
| AI provider          | Configurable server-side model adapter (planned in `AGENT-01`) | Tool-using extraction, cited explanation, constrained structured output                                |

Neither frontend imports API internals. All three applications share HTTP schemas through `packages/contracts` and keep their runtime dependencies separate. Source credentials remain server-side. The two frontends have independent builds and use the same API and PostGIS database.

## Architecture decisions and module ownership

The pnpm monorepo is one change/SDD/review unit with independently buildable API and web apps. Node.js is the initial I/O-oriented backend runtime; PostGIS handles indexed spatial operations. A dedicated worker can reuse backend modules in a separate process once ingestion is implemented. Rust may be introduced for a measured CPU-intensive geospatial workload, not as a second default service runtime. This section is the canonical record of these decisions.

The API is a modular monolith. Functional modules live under `apps/api/src/modules/<capability>/`, own complete business capabilities and communicate through documented public entry points. Database infrastructure remains under `apps/api/src/db/`; HTTP composition remains in `app.ts`/`server.ts`. Browser functionality is similarly isolated behind client and component boundaries.

Each owned module has a `contract.md` describing its published interface, data, permitted dependencies, invariants and extension points. Read [IMPLEMENTATION](IMPLEMENTATION.md) for the exact current module list. Shared HTTP schemas live once in `packages/contracts`; there are no direct FE-to-BE implementation imports, circular capability dependencies or direct cross-owner table queries. Prefer focused reuse over copied validation or speculative cross-cutting abstractions.

## Ingestion and evidence model

The current implementation has a **restricted HTTPS fetch transport** used by a manual local-administrator collector, with ingestion-run and evidence persistence; it has no region-wide worker or scheduler. Future source jobs use the explicit path: **source registry -> approved fetch -> immutable fetch record -> extraction -> validation -> deduplication -> geospatial normalization -> review status -> published observation**. Each observation retains a direct source link, publication/retrieval times, run ID, raw content fingerprint, geometry precision and claim status. Unknown is different from safe. Provider failures preserve existing source-attributed observations with their review status and freshness metadata, or return unavailable when no valid snapshot exists.

First-party, institutional and third-party sources each require their own license/access decision. Source adapters are separately switchable. The first source priority is a **configurable structured treatment provider** (the historical Saturn portal is a reference candidate), followed by municipal notices, OpenStreetMap/Overpass, Open-Meteo and Copernicus Data Space. The purported Saturn endpoint, region mapping and unrestricted usage asserted in the reference prototype are **not** treated as verified contracts.

### Provider-specific request policy boundary

The generic restricted HTTPS transport does not embed Saturn URLs or branch on Saturn-specific profile identifiers. Instead, each trusted provider adapter may register a named `SourceRequestProfile` with an exact source ID, exact endpoint URLs, and constrained, non-credential header metadata. The fetcher rejects missing, mismatched, or unregistered profiles before DNS and applies its ordinary approved-destination, DNS/IP, TLS, redirect, response-size, and MIME checks independently of the profile.

The first adapter-owned policy lives in [Saturn's provider module](../apps/api/src/modules/sources/providers/saturn/contract.md). The existing Saturn query and collection implementations still need to be moved behind an explicit capability interface; this incremental separation does not claim that the broader ingestion module has been refactored.

## Spatial processing

Use WGS84 (EPSG:4326) at HTTP boundaries; use PostGIS `geography` for meter-based distance operations and spatial indexes for polygon searches. Do not infer field geometry from place-name centroids or label uncertain geometry as cadastral precision. Mark observation precision (`exact_polygon`, `approximate_area`, `text_only`). All environmental conclusions require documented, independently verified models and field validation.

## AI agent design

The agent is a **server-side bounded workflow**, not a free-running service with direct database or unrestricted browsing access.

1. A scheduler selects an approved source or a user asks about a location.
2. Deterministic tools fetch source content, resolve documented places, retrieve nearby observations and obtain weather/phenology evidence.
3. A configurable LLM adapter extracts notices into a strict schema or drafts a source-cited explanation. The model receives sanitized, bounded inputs, never secrets or precise private apiary coordinates.
4. Validation checks mandatory fields, dates, evidence URLs, duplicates, confidence **categories** (not fabricated probabilities), source freshness and spatial uncertainty.
5. The system persists pending/reviewed/rejected statuses and audit trail. High-impact ambiguous records are held for review; agent text is not authoritative evidence.

Proposed settings: `AI_PROVIDER`, `AI_MODEL`, provider API key, per-run token/time limits, tool allowlist, retry limits, extraction schema version and dry-run/review policy. AI adapters and tool registries belong in separate API modules when `AGENT-01` is selected.

## Scope and provenance

The supplied October 2026 reference prototype informed the map-centric layout and source domains. Its hard-coded fields, apiaries, sample weather, risk scores, unsupported satellite-confidence percentages, and agronomist/social flows were **not** imported as live product data. The first runnable vertical slice intentionally supports real Open-Meteo inspection and an honest source catalog. Later capability is described in specs rather than shipped as inert endpoints.

### Manual provider-to-map evidence boundary

The local operator HTTP boundary (`apps/api/src/app.ts`) invokes `TreatmentIngestionService` without a browser-held token but is restricted to loopback and the administrator browser origin. It derives a restricted configured treatment destination before external retrieval. `source_documents` holds immutable raw page versions, `source_observations` holds source-derived candidates and spatial precision, and `source_observation_reviews` records the first operator verification/rejection decision. The public notices API projects verified WGS84 polygons and technically valid structured pending polygons, with original source attribution and explicit review status; rejected and text-only records remain private. The frontend renders these as sourced map overlays, with no direct browser-to-provider traffic. S3b adds a bounded regional collection worker; source-side deletion reconciliation and conflict resolution remain future work.

## Administrator and client boundary (S3a.4)

The beekeeper client at `http://127.0.0.1:5173` calls only `GET /api/v1/notices` for valid source-attributed field geometry and the weather inspection API. The separately built local administrator frontend at `http://127.0.0.1:5174` uses `/api/v1/operator/*` for connection editing, a bounded explicit import, record review, status and pending map preview. Configuration saves do not fetch the provider.

The backend currently binds loopback; operator routes reject the beekeeper browser origin and allow the local administrator origin. **Browser origins and separate bundles are not authentication.** Never make operator routes publicly accessible without independent server-side administrator identity, authorization and network controls. In-app notification events, source-side deletion reconciliation and private apiaries are subsequent stages. Bounded regional scans now run in the same backend, with persisted progress and optional UTC scheduling.

### Bounded regional collection (SRC-01/S3b)

`apps/api/src/modules/sources/regionalCollection.ts` runs in the existing API process. It persists the configured provider region's next page and progress in `source_catalog.source_cursor`, claims one provider call at a time and delegates all HTTP/validation/storage to `TreatmentIngestionService`. Optional UTC-hour scheduling is server-side. The local `apps/admin` controls collection; `apps/web` reads only PostGIS by viewport bbox. Migration 010 records the last observed time of each immutable source JSON version, enabling a latest-known-version map projection. There is no queue service, Redis, push transport, cross-country scheduler or new source registration mechanism. Completing provider pagination does not establish complete real-world treatment coverage or source reuse rights.

The first S3c district-cache increment adds `source_district_cache` (migration 011), keyed by provider source, configuration revision, provider district ID, and verified filter hash. Coverage becomes fresh for 24 hours only after complete pagination. The existing region-wide worker is no longer wired into server startup. Operator status is read-only, and live district refresh deliberately fails closed until provider filter keys and IDs are validated from a real response. The public map remains a PostGIS-only read path.
