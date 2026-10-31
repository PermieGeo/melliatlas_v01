---
type: UmbrellaSpec
title: MelliAtlas MVP
spec_status: draft
current_focus: SRC-01
baseline: 2026-10-31 starter source assembled from the supplied October 2026 prototype and requirements document
---

# MelliAtlas MVP — Umbrella Specification

## 1. Product purpose

**MelliAtlas helps beekeepers understand territory, nectar opportunities and agricultural treatment notices on one map.** The first pilot covers Smolensk Oblast, with a regional configuration model suitable for later deployment in other Russian and Belarusian regions.

The user chooses a point or saves a private apiary, sees geographically relevant findings, examines the original evidence, and receives a plain-language explanation of its freshness, location certainty and practical significance. The differentiator is the **combination of traceable heterogeneous sources, spatial context and a configurable evidence-reading agent** instead of a static collection of map markers.

Primary user: an individual beekeeper, including owners of mobile apiaries. Secondary user: a project operator reviewing data quality and configuring connectors. The application is usable on phones and desktop browsers.

## 2. MVP user journeys

1. **Inspect a location:** open the map, select a region/point, set the desired viewing radius, and request a weather report with source attribution.
2. **Examine notices:** see published agricultural treatment notices within the spatial coverage of a selected area; open the original notice; distinguish upcoming, past, uncertain and manually reviewed records.
3. **Explore nectar context:** view available land-cover and plant/phenology evidence, including observed and estimated bloom windows with source, date and uncertainty.
4. **Protect an apiary:** save accurate coordinates in an access-controlled account; query nearby verified notices and their dates while preserving the confidentiality of the exact site.
5. **Understand a finding:** request an agent-produced summary linking each material statement to specific evidence and exposing missing or conflicting information.
6. **Carry points elsewhere:** select geographic points and export supported coordinates for external navigation, including a Yandex Maps/Navigator handoff when its supported URL scheme and waypoint limits are verified.

## 3. Functional domains and delivery order

| Feature                               | MVP requirements                                                                                                                                           | Indicative solo SDD effort* |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------: |
| **SRC-01 — Sources and evidence**     | Approved source registry, municipal fetch jobs, document history, normalization, geospatial uncertainty, deduplication, source-status API and map overlays |              **14–24 days** |
| **BEE-01 — Private apiaries**         | Accounts, ownership checks, encrypted transport, private coordinates, distance/region queries, audit and retention                                         |               **7–12 days** |
| **AGENT-01 — Evidence agent**         | Provider config, bounded tools, strict structured extraction, source citations, prompt-injection controls, human review and evaluation set                 |              **10–18 days** |
| **SAT-01 — Land-cover and phenology** | OSM land cover, regional vegetation taxonomy, imagery access, temporal statistics, calibration/ground-truth and uncertainty layers                         |              **12–25 days** |
| **ALERT-01 — Monitoring**             | Subscriptions to user-selected locations, date-window filtering, deduplicated alerts, delivery receipts and reviewable history                             |               **6–11 days** |
| **MOBILE-01 — Product hardening**     | Responsive map UX, touch/keyboard flows, selective caching, performance, service reliability, accessibility and mobile E2E                                 |               **6–10 days** |

*A focused day is approximately eight hours of solo engineering using the user's SDD workflow, including implementation, tests and review preparation. These are planning ranges, **not delivery commitments**; source access, scientific field validation, legal review, and external coordination are additional uncertainties. Dependencies overlap, so summing all upper bounds is intentionally conservative.

**Selected now:** [SRC-01 source ingestion](subspecs/source-ingestion.md), with its [current implementation plan](source-ingestion-implementation-plan.md). Only this child is authored at bootstrap; future children are created just in time.

## 4. Sources and evidence

| Source family                           | Intended use                                             | Required validation before production use                                                                     |
| --------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Official municipal administration sites | Treatment announcements, notices, publication dates      | Hostname, permission/terms, publication semantics, pagination and attachment formats                          |
| Public Saturn-related portal            | Treatment plans and available field geometries           | Actual endpoint/contract, authentication, field meaning, region IDs, rights and reliable incremental updates  |
| OpenStreetMap / Overpass                | Land use, roads, protected areas, place boundaries       | License/attribution, completeness by region, geometry reliability and usage limits                            |
| Open-Meteo                              | Forecast model values at a selected point                | Units, update cadence, usage rights, timestamp handling, rate limits                                          |
| Copernicus Data Space                   | Multispectral imagery and temporal vegetation indicators | Subscription/permissions, coverage/cloud screening, processing costs and independent crop-specific validation |

Every user-facing observation has a stable ID, source ID/URL, publication and collection times when known, document hash/run ID, status (`pending`, `verified`, `rejected`), geometry and **spatial precision**, and a freshness policy. Missing coverage is an explicit state. An LLM prediction never converts itself into an official record.

### Scientific and regulatory evidence

Satellite NDVI/NDYI, vegetation color and growing-degree models are **research signals** until locally validated with labeled crop/flowering ground truth. The source concept includes suggested universal thresholds, accuracy percentages, pesticide drift distances, safe spraying windows, apiary-blurring guarantees and ecosystem carrying capacities; none is accepted as a proven default merely because it appears in an earlier proposal. Any actionable risk classification requires an explicit methodology, its evidence, region-specific validation and review of applicable regulations.

## 5. AI agent — behavior and configuration

The agent runs **in the backend**, triggered by scheduled source ingestion or an explicit user request. A deterministic workflow engine owns tool access and persistence; the language model is an exchangeable extraction/explanation component.

### Agent pipeline

1. **Trigger:** a verified source has changed, or a user asks to explain a particular map area/time period.
2. **Gather:** tools retrieve allowlisted pages/attachments, catalog records, nearby verified observations, bounded weather data and documented spatial relations.
3. **Extract:** the model parses a notice into a versioned schema: issuer, location text, geometry reference if present, treatment window, crop, substance as written, restrictions as written, source excerpt offsets and unresolved fields.
4. **Check:** schema validation, calendar sanity, geometry precision, duplicate/version matching, links to original content, bounded confidence categories and contradiction checks. Product catalogs and pesticide classes require independent reference data; unknown stays unknown.
5. **Review:** uncertain or high-impact extracted notices are queued for operator review with side-by-side raw document and structured proposal. Review decisions and model/schema versions are retained.
6. **Explain:** the agent uses read-only search tools to produce a cited summary of evidence and gaps for the selected location; every cited claim points back to a stored document, verified observation or real provider result.

### Tool policy and settings

| Item                                                      | Contract                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_PROVIDER`, `AI_MODEL`, credential                     | Server-only, validated at startup for agent deployments; secrets injected at runtime                                                  |
| `AGENT_MAX_STEPS`, `AGENT_TIMEOUT_MS`, `AGENT_MAX_TOKENS` | Per-run budgets and cancellation; failures are observable                                                                             |
| `AGENT_ALLOWED_TOOLS`                                     | Named read-only tools, bounded geospatial queries and approved source fetch; no arbitrary SQL, shell execution or URL browsing        |
| `AGENT_SCHEMA_VERSION`                                    | Strict output schema; version recorded with every extraction                                                                          |
| `AGENT_REVIEW_MODE`                                       | Mandatory review when location, timing, substance, legal status or provenance is ambiguous                                            |
| `AGENT_SOURCE_POLICY`                                     | Allowlist of source IDs/hosts, retention, content-size limit, freshness and retrieval quotas                                          |
| Evaluation                                                | Held-out notices, negative/adversarial pages, field-wise precision/recall, citation accuracy, latency and cost per processed document |

Tool input and outputs are independently validated. Web content is untrusted and cannot change agent configuration. The backend records request IDs, tool outcomes, extraction version, citations and review actions without leaking private apiary coordinates or provider secrets.

## 6. Architecture and data contracts

- One repository with `apps/web` (React/TypeScript/Leaflet), `apps/api` (Node.js/TypeScript) and `packages/contracts` (versioned Zod schemas); separately deployable apps.
- PostgreSQL/PostGIS stores spatial data, source runs, versions, provenance and private user records. Provider-specific connectors run server-side; later background jobs reuse the backend modules in a separate process.
- HTTP endpoints are versioned under `/api/v1`, validate input/output, expose structured error codes and include request IDs.
- Time values are RFC 3339 UTC with an explicit source timezone when originally known; coordinates are WGS84; distance checks use PostGIS meter-based geography operations.
- Client map layers include attribution, freshness and loading/failure states. Mobile uses responsive touch-aware UI; a native shell is an optional delivery mechanism after product validation.

See [Architecture](../../ARCHITECTURE.md) and [ADR-0001](../../adr/0001-monorepo-and-runtime.md).

## 7. Privacy, security and reliability

- Authenticate ownership before reading/writing private apiary positions; use least-privilege database roles, TLS and controlled retention. Public area sharing must not reveal exact coordinates through API responses, logs, prompts or predictable obfuscation.
- Remote fetch uses strict host allowlists, DNS/redirect restrictions, bounded payload sizes, MIME validation, timeouts, retry budgets and rate limits. Preserve source material in a revisioned store.
- Duplicate runs, restarts, partially parsed files and intermittent provider outages must not publish inconsistent observations.
- Include unit, integration, migration, HTTP contract, geospatial, Playwright E2E and bounded-load tests. Mock provider failures independently from browser fixtures.
- Record provider permissions, source uncertainty and regulatory assumptions before shipping public risk guidance.

## 8. MVP acceptance outcomes

The MVP can be accepted after a developer-reviewed pilot demonstrates: (a) **real** source ingestion and navigable source links; (b) reliable spatial/time filtering with explicit unknown states; (c) a private apiary workflow with verified access control; (d) correctly attributed weather and land/phenology evidence; (e) an agent that extracts and explains with independently checked citations and review gates; (f) effective mobile map interaction; and (g) repeatable builds, migrations, tests and failure recovery. Each selected child is reviewed separately before archive.
