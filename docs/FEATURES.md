# MelliAtlas Feature Catalog

This catalog describes **what the product can do or is intended to do**. It is organized around long-lived capabilities, not delivery milestones. An ID identifies a capability across releases, sub-specifications, code modules and tests; it does **not** claim that a feature is complete.

## Sources and trustworthy evidence

| Feature ID                  | Capability                                        | State       | Notes                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOURCES.CATALOG`           | Inspect and maintain the source registry          | **Partial** | PostgreSQL registry now stores reviewed-access metadata and version history; read-only approved-source lookup exists. Authenticated operator changes and run status remain planned. |
| `SOURCES.SATURN_CONFIGURATION` | Configure a proposed Saturn API through operator UI and typed runtime parameters | **Partial** | Authenticated, revisioned connection settings and offline request construction; no reviewed endpoint, fetch, records or map layer yet. |
| `SOURCES.DOCUMENT_HISTORY`  | Fetch and retain revisions of source documents    | Planned     | Metadata and run schemas exist; no fetching, immutable payload storage, deduplication or restart recovery yet.                                                                      |
| `SOURCES.SAFE_FETCH`        | Retrieve external evidence within approved limits | **Partial** | Offline destination preflight enforces reviewed hosts and paths; DNS, redirects, transport limits and fetching remain planned.                                                      |
| `NOTICES.EXTRACTION`        | Turn published notices into reviewable records    | Planned     | Initial text-only candidate schema exists; no parser, geometry validation, publication or review workflow yet.                                                                      |
| `NOTICES.SPATIAL_PRECISION` | Explain exactly how well a notice is located      | Planned     | Distinguish published field polygons, approximate areas and text-only place names.                                                                                                  |
| `NOTICES.MAP_OVERLAY`       | See genuine agricultural notices on the map       | Planned     | Time/area filters, review state, original-document links and accessible map/list views.                                                                                             |

## Mapping and weather

| Feature ID               | Capability                                        | State                     | Notes                                                                                                                |
| ------------------------ | ------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `MAP.POINT_SELECTION`    | Select a point and inspect its coordinates        | **Implemented bootstrap** | Interactive Leaflet map, region selection and radius display; no notice-layer filtering yet.                         |
| `WEATHER.POINT_FORECAST` | Inspect attributed forecast conditions at a point | **Implemented bootstrap** | Open-Meteo adapter, validated API response, source URL and timestamps. No inferred treatment risk.                   |
| `UX.MOBILE_MAP`          | Use the map comfortably on mobile devices         | **Partial**               | Responsive layout and one mobile-browser happy-path test; accessibility and failure paths need broader verification. |

## Apiaries, environment and assistance

| Feature ID                   | Capability                                           | State   | Notes                                                                                                |
| ---------------------------- | ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `APIARIES.PRIVATE_LOCATIONS` | Store private apiaries and inspect nearby evidence   | Planned | Authentication, ownership enforcement, precise-location confidentiality and distance queries.        |
| `AGENT.NOTICE_READING`       | Extract notice fields using a controlled AI workflow | Planned | Replaceable model adapter, constrained tools, typed output, independent validation and human review. |
| `AGENT.CITED_EXPLANATION`    | Explain area findings with verifiable citations      | Planned | Source-bound claims, freshness, conflict disclosure, explicit uncertainty and bounded request costs. |
| `LANDCOVER.EVIDENCE`         | Explore documented vegetation and land-cover context | Planned | Licensed OSM/imagery evidence, completeness indicators and validated spatial processing.             |
| `PHENOLOGY.BLOOM_WINDOWS`    | Estimate likely flowering periods from evidence      | Planned | Regional taxonomy, seasonal context, confidence limits and field calibration before decisions.       |
| `ALERTS.AREA_SUBSCRIPTIONS`  | Monitor selected areas for relevant new evidence     | Planned | User-controlled subscriptions, deduplication, delivery history and privacy limits.                   |

## Identifier rules and traceability

- **Feature IDs** are stable, semantic `DOMAIN.CAPABILITY` names such as `NOTICES.MAP_OVERLAY`. Reuse an ID when more than one stage or requirement contributes to that capability. Create a new ID only for a genuinely separate, durable user capability.
- **Stage IDs** such as `SRC-01` or `AGENT-01` identify delivery workstreams; **requirement IDs** such as `SRC-R04` identify obligations within a sub-specification. Neither is a feature ID.
- The machine-readable [feature cross-reference](specs/feature-cross-ref.yaml) connects feature IDs to **multiple** stages, spec documents, requirement IDs, implemented owners and tests. An empty code/test list means **not implemented**, not untracked success.
- When an implementation, test or requirement changes, update that cross-reference and the owning module's `contract.md`. Keep status statements here grounded in executable evidence.

See [the umbrella specification](specs/active/spec-umbrella-melliatlas.md) for the intended product, [the roadmap](ROADMAP.md) for delivery order, and [current implementation](IMPLEMENTATION.md) for existing code.
