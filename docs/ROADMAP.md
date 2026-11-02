# MelliAtlas Delivery Roadmap

| Order          | Feature                                                                                                            | Intended evidence                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **1 — SRC-01** | Configurable structured treatment provider first, then approved municipal ingestion and live evidence map overlays | Authenticated Provider settings, verified access, cited source links, geometry precision, failure/retry tests |
| 2 — BEE-01     | Private apiary records and proximity queries                                                                       | Authenticated ownership, no exact-coordinate exposure, spatial tests                                          |
| 3 — AGENT-01   | Configurable source-reading AI agent                                                                               | Strict extraction schemas, cited tool evidence, injection defenses, human review                              |
| 4 — SAT-01     | Sentinel-2 and phenology research path                                                                             | Licensed access, time-series storage, independently validated field observations                              |
| 5 — ALERT-01   | User-controlled monitored areas and notices                                                                        | Deduplicated alerts, time windows, privacy and delivery receipts                                              |
| 6 — MOBILE-01  | Touch-polished PWA and optional mobile shell                                                                       | Mobile E2E, offline boundaries, opt-in geolocation                                                            |

## Out-of-sequence documentation maintenance (before SRC-01 / S3)

Review and correct the local installation, configuration, usage, verification and troubleshooting guidance against the implemented `SRC-01 / S2` code. This maintenance increment does **not** complete a normative source-ingestion requirement, authorize provider access or change the developer-controlled SDD checkpoint. The next product work remains external-access/contract verification followed by the durable structured-provider adapter.

This is a _sequence of prospective scopes_, not a set of pre-approved or completed child specifications. Only the selected `SRC-01` has a current normative sub-spec and implementation plan. Its first source-backed weather-map slice is implemented as the repository's bootstrap capability; the remaining `SRC-01` work is planned.

## Current source-ingestion increment

`SRC-01 / S3a` adds manual, permission-reviewed source ingestion and a map layer containing individually verified polygons. The reference endpoint remains a candidate whose automation/republication rights and live response contract must be checked independently. The next planned slices are source-contract validation and durable multi-page worker/retraction handling, followed by municipal adapters and full spatial evidence acceptance.

## Agreed minimal follow-up after S3a.4

The next data stage is a conservative, restart-safe, whole-region collection for a configured source/region with full coverage accounting and off-peak scheduling. It must never fetch on beekeeper map requests. After that, private apiaries and a persisted in-app change indicator can be added using local database reads/polling, without Web Push or a separate message broker. Server-side administrator authentication is a prerequisite for remote/public admin deployment.
