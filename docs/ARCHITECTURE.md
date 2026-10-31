# MelliAtlas Architecture

## Shape and deployment

MelliAtlas starts as one repository with **separately buildable and deployable applications**. Node.js/TypeScript is the initial API runtime for rapid integration, while Rust remains an optional future choice for isolated CPU-intensive image/geospatial analysis if profiling justifies it.

| Component            | Technology                                                     | Boundary                                                                                               |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `apps/web`           | React 19, Vite, Tailwind CSS 4, Leaflet                        | UI state, map interaction, accessible source summaries                                                 |
| `apps/api`           | Node.js 22, TypeScript, Express                                | Authenticated integration gateway, validation, provenance, source jobs, AI orchestration               |
| `packages/contracts` | Zod, TypeScript                                                | Versioned `/api/v1` JSON schemas                                                                       |
| Database             | PostgreSQL 16 + PostGIS 3                                      | Source metadata, ingest runs, normalized observations, indexed geometries and private application data |
| Background workers   | Dedicated Node.js process (planned in `SRC-01`)                | Scheduled fetch, parsing, normalization and idempotent persistence                                     |
| AI provider          | Configurable server-side model adapter (planned in `AGENT-01`) | Tool-using extraction, cited explanation, constrained structured output                                |

The web app never imports API internals. The API imports only the contracts package. Database credentials and AI/source credentials remain on the server. Both apps have independent local and production build commands.

## Ingestion and evidence model

Future source jobs use the explicit path: **source registry -> approved fetch -> immutable fetch record -> extraction -> validation -> deduplication -> geospatial normalization -> review status -> published observation**. Each observation retains a direct source link, publication/retrieval times, run ID, raw content fingerprint, geometry precision and claim status. Unknown is different from safe. Provider failures preserve the previous verified snapshot with freshness markers, or return unavailable when no valid snapshot exists.

First-party, institutional and third-party sources each require their own license/access decision. Source adapters are separately switchable. Primary candidates are public municipal notices, a **provisionally identified** Saturn portal, OpenStreetMap/Overpass, Open-Meteo and Copernicus Data Space. The purported Saturn endpoint, region mapping and unrestricted usage asserted in the reference prototype are **not** treated as verified contracts.

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
