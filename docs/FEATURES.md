# MelliAtlas Features

This catalog separates **available behavior** from **planned capability**. The IDs remain stable across specifications and code changes; a feature ID does not imply completion.

| ID          | Capability                                            | Current state                                                                                                                                              | Owner                                  |
| ----------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `SRC-01`    | Source catalog, evidence ingestion and mapped notices | **Partial**: database-backed source catalog and live attributed Open-Meteo location inspection. Municipal ingestion, notice APIs and overlays are planned. | API sources/weather, database, web map |
| `BEE-01`    | Private apiary locations and geospatial proximity     | Planned                                                                                                                                                    | API security and apiaries, web         |
| `AGENT-01`  | Configurable server-side evidence-reading agent       | Planned                                                                                                                                                    | API agent and source modules           |
| `SAT-01`    | Land-cover, vegetation and phenology evidence         | Planned                                                                                                                                                    | API geospatial/imagery modules         |
| `ALERT-01`  | Area subscriptions and source-backed notifications    | Planned                                                                                                                                                    | API monitoring, web                    |
| `MOBILE-01` | Mobile usability and optional installable shell       | **Partial**: responsive browser UI and mobile E2E project. PWA/offline/shell enhancements are planned.                                                     | Web                                    |

## Naming and references

- Use existing IDs in the [umbrella specification](specs/active/spec-umbrella-melliatlas.md), [roadmap](ROADMAP.md) and tests when they aid navigation.
- Do not invent new IDs for ordinary implementation steps or refactors. New long-lived capabilities receive an ID here before other documents reference it.
- `SRC-R01` and `SRC-T01` identify a **requirement** and **test scenario**, respectively; they are not feature IDs.
- [feature-ids.json](specs/feature-ids.json) indexes currently implemented bootstrap owners and tests, not this entire future catalog.

Implementation details belong in [IMPLEMENTATION](IMPLEMENTATION.md); planned acceptance conditions belong in [specifications](specs/README.md).
