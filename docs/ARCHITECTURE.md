# MelliAtlas Architecture

MelliAtlas is an evidence-first GIS for beekeepers. Its runtime is a **modular monolith** in one pnpm repository: two separately built React/Leaflet applications, one Node.js/Express API, shared Zod wire contracts and PostgreSQL/PostGIS. See the two diagrams in the [root README](../README.md) for module boundaries and evidence flow.

## Runtime ownership

| Module                             | Responsibility                                                                          | Public boundary                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/web`                         | Responsive beekeeper map, source-backed notices, weather and local viewport-index pilot | Browser `/api/v1` client                           |
| `apps/admin`                       | Loopback operator configuration, bounded collection, review and diagnostics             | Browser `/api/v1/operator/*` client                |
| `apps/api/src/app.ts`, `server.ts` | HTTP routing, security headers, error mapping, dependency composition                   | Versioned HTTP responses                           |
| `apps/api/src/modules/core`        | Typed provider registry and sequential, code-defined DAG scaffold                       | `core/index.ts`; no public graph endpoint          |
| `apps/api/src/modules/weather`     | Fixed-source Open-Meteo inspection                                                      | `OpenMeteoAdapter.inspect`                         |
| `apps/api/src/modules/sources`     | Source policy, ingestion, evidence, PostGIS notice projection and provider ports        | Source services/ports; Saturn submodule `index.ts` |
| `apps/api/src/db`                  | Pool, public catalog SQL and immutable migration runner                                 | Narrow database/repository API                     |
| `packages/contracts`               | Shared Zod request/response contracts                                                   | `src/index.ts`                                     |

Each owner publishes only cross-module contracts in its `contract.md`. Other modules should not import provider-private parsers or repository implementation details. Browser applications never access source provider APIs or raw SQL.

## Information providers and analysis

Source adapters are independently switchable. Open-Meteo currently produces attributed forecast responses. The legacy configured treatment-feed parser can ingest one explicitly requested bounded page into immutable `source_documents` and reviewable `source_observations`. The Saturn adapter separately supports an explicit local **viewport map-index** pilot and cached district names/center points.

`core` registers the weather adapter and a **read-only** Saturn persisted-index status adapter. `AnalysisGraph` can run trusted nodes labelled `provider`, `algorithm`, `statistics`, `ml` or `llm` sequentially, with dependency and schema checks. No real ML/LLM executor, background run, multi-source forecast synthesis or apiary migration recommendation is connected. Further executors must preserve evidence lineage and bounded access.

Every retrieved item needs source identity, original URI or capture reference, retrieval time, immutable version and explicit precision/review state. Forecast values, provider-reported planned actions, computed estimates and independently verified observations are different kinds of evidence. **Unknown is not safe.** Source-access and republication terms remain subject to independent review.

## Collection and persistence boundaries

- A local operator may edit the provider connection without starting any download, explicitly fetch one treatment-feed page, inspect evidence, and review candidate observations.
- The experimental Saturn directory and `/query` viewport collector are **off by default** behind `SATURN_VIEWPORT_LIVE_ENABLED`. Each explicit operation uses fixed URLs, restricted TLS/DNS transport, source-wide persistent throttling, audited attempts and durable PostGIS checkpoints. Cached reads use no upstream traffic.
- A provider district entry is a named **center**, not a district polygon. A completed viewport-index page sequence is not proof of complete district coverage, a treatment or an identified spray date. `UpdateMap` filters have unverified agricultural semantics. Investigatory offline polygon/ACR ID comparisons must not become published joins.
- Legacy S3b regional worker and optional UTC scheduling code remain in the repository but **are not started by `server.ts`**. Persisted S3c district-cache structures do not enable refresh without independently verified provider filters. Ordinary map reads fetch only stored PostGIS data.
- Structured pending polygon observations that pass technical validation may appear publicly with a visible unverified status. Verified records retain their own review state; rejected and text-only evidence is excluded from the published polygon layer. No safety inference follows from either status.

## Geographic and security rules

HTTP geometry uses WGS84 / EPSG:4326 (GeoJSON longitude before latitude). PostGIS owns geospatial persistence and indexed queries; future meter-distance searches must use appropriate geography semantics. A text place-name centroid must never be labelled as a verified field polygon.

Provider transport rejects unapproved destinations, unsafe redirects/addresses, inappropriate payloads and invalid response types. Provider credentials never go to browsers. The local operator and experimental client fetch endpoints check loopback/origin, but **neither is safe for public exposure without authentication, authorization and abuse prevention**. Future precise apiary coordinates require tenant ownership and explicit privacy guarantees.

## Planned, not yet delivered

The [umbrella specification](specs/active/spec-umbrella-melliatlas.md) defines private apiaries, controlled source-reading AI with citations, land-cover/phenology evidence, monitored areas and mobile maturity. User-discussed multi-source migration suggestions (candidate points and dates) and a date/region-based community hazard board are promising **design directions**, not implemented or normative requirements. Add testable specifications and a linked plan before treating them as product contracts.

See [Implementation](IMPLEMENTATION.md) for concrete current classes, [Features](FEATURES.md) for feature IDs, and [Roadmap](ROADMAP.md) for delivery order.
