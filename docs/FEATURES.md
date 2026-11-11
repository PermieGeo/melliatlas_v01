# MelliAtlas Feature Catalog

Feature IDs denote durable capabilities, **not** proof of completeness. The [cross-reference](specs/feature-cross-ref.yaml) indexes annotated implementation/test files, linked stages and requirements. Current code behavior is summarized in [Implementation](IMPLEMENTATION.md); intended behavior is governed by the [active specifications](specs/README.md).

| Feature ID                       | State                 | Current boundary / outstanding work                                                                                                                                                                      |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOURCES.CATALOG`                | Partial               | Source catalog, reviewed-access metadata, local operator browsing; no broad verified source coverage.                                                                                                    |
| `SOURCES.PROVIDER_CONFIGURATION` | Partial               | Revisioned local treatment-feed settings, typed parameters, manual one-page import; no verified upstream usage grant.                                                                                    |
| `SOURCES.DOCUMENT_HISTORY`       | Partial               | Immutable evidence, operator review history, persisted Saturn viewport indexes, exact-filter cache/history and explicit local one-page retrieval; no proven full district coverage or automatic refresh. |
| `SOURCES.SAFE_FETCH`             | Partial               | Restricted backend TLS/DNS/redirect/size/MIME/time transport, per-source throttling and audit; no currently running regional scanner or blanket source permission.                                       |
| `NOTICES.EXTRACTION`             | Partial               | Structured treatment-feed parser and reviewable observations exist; multi-format notice extraction and LLM-assisted extraction are future work.                                                          |
| `NOTICES.SPATIAL_PRECISION`      | Partial               | WGS84 structured polygons, source geometry checks, explicit precision/review metadata; place-name-only and approximate area claims do not become precise field polygons.                                 |
| `NOTICES.MAP_OVERLAY`            | Partial               | PostGIS-backed visible-viewport polygons, source links, labelled pending/verified states; broader coverage, temporal queries and comprehensive notice layer remain future work.                          |
| `MAP.POINT_SELECTION`            | Implemented bootstrap | Interactive Leaflet point/radius selection; no persistent private apiary or risk search.                                                                                                                 |
| `WEATHER.POINT_FORECAST`         | Implemented bootstrap | Validated attributed Open-Meteo forecast inspection; no pesticide safety calculation.                                                                                                                    |
| `UX.MOBILE_MAP`                  | Partial               | Responsive map and initial browser tests; further accessibility/device coverage needed.                                                                                                                  |
| `APIARIES.PRIVATE_LOCATIONS`     | Planned               | Authentication, per-owner location privacy, proximity queries.                                                                                                                                           |
| `AGENT.NOTICE_READING`           | Planned               | Model adapter, controlled extraction, validation and review. The current `core` DAG is only infrastructure.                                                                                              |
| `AGENT.CITED_EXPLANATION`        | Planned               | Evidence-cited, uncertainty-aware explanations; no active LLM.                                                                                                                                           |
| `LANDCOVER.EVIDENCE`             | Planned               | Licensed and spatially validated vegetation/land-cover context.                                                                                                                                          |
| `PHENOLOGY.BLOOM_WINDOWS`        | Planned               | Seasonal flowering estimates with independent calibration and uncertainty.                                                                                                                               |
| `ALERTS.AREA_SUBSCRIPTIONS`      | Planned               | Private monitored areas, deduplicated events and auditable delivery.                                                                                                                                     |

## Traceability rules

- A `DOMAIN.CAPABILITY` feature ID may span multiple stages and requirements. A stage ID (for example `SRC-01`) and a requirement ID (for example `SRC-R33`) are **not** feature IDs.
- Source and test files declare applicable `// Feature IDs:` metadata. The machine-readable cross-reference must agree with those annotations. Feature entries without code/test paths are genuinely **planned**, not silently implemented.
- Use an existing ID where its intent already fits; introduce a new one only for a distinct durable capability. Update metadata, implementation, relevant tests and this catalog together.

## Current rollout context

The selected `SRC-01/S3c` targets district-scoped source evidence. Migration-backed district/cache storage and the opt-in Saturn viewport-index pilot exist, but a saved viewport is not a complete district scan. The retired S3b region-wide scheduler is not started. Source rights, district/period filters, polygon identity and actual treatment-date semantics still need verification before broader collection.

The discussed candidate apiary-migration routes/dates and region/date-based community hazard board are **not yet assigned normative feature IDs** or approved sub-specifications.
