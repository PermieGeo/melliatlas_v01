---
type: UmbrellaSpec
title: MelliAtlas MVP
spec_status: draft
current_focus: SRC-01
baseline: 2026-10-31 starter and approved documentation overlay
---

# MelliAtlas — The MVP We Want to Build

## 1. The idea

MelliAtlas is a geographical workspace for beekeepers. Its central question is simple:

**What is happening around my bees, where did that information come from, and how much can I trust it?**

Beekeepers often need to bring together several kinds of information: agricultural treatment announcements, nearby vegetation, flowering seasons, weather and the location of their apiaries. The information is scattered across municipal websites, maps, forecasts and documents. Some of it is incomplete or difficult to interpret.

MelliAtlas brings the evidence onto one map. It should save time without pretending that a model estimate is an official notice or that an empty search means an area is safe.

Our first pilot is **Smolensk Oblast, Russia**. The architecture should allow other Russian and Belarusian regions later, but we will test source coverage and local usefulness in one region first.

### Who will use it?

- **A beekeeper** explores an area, checks its sources, and may save the location of a stationary or mobile apiary.
- **A project operator** manages source permissions, reviews questionable extracted records, and diagnoses missing or stale information.

The first client is a responsive web application, usable on desktop and mobile browsers. A separately packaged mobile app may follow if there is a real need.

## 2. A typical visit to MelliAtlas

Imagine a beekeeper considering a place near a village:

1. They open the map, choose the area and select a point. The app shows coordinates and a clear viewing radius.
2. They request a weather inspection. The forecast appears with the provider, observation time and retrieval time. If the provider is unavailable, they see an error, not invented weather.
3. They switch on the agricultural-notice layer. Each available notice links to its original publication and identifies its date, review state and location precision. A notice that only mentions a village does not appear as an exact field polygon.
4. They check vegetation and likely flowering conditions, with clear distinctions between observed data, derived estimates and missing coverage.
5. If signed in, they may save the apiary privately, monitor nearby notices, and later receive relevant alerts.
6. An optional assistant summarizes the evidence and explains disagreements. It never turns uncited claims into facts.

Steps 1 and the weather part of step 2 exist in the starter. The remaining steps are **planned**. The steps are a picture of the desired experience, not a claim that every screen already works.

## 3. What is available today

The bootstrap and subsequent source-ingestion increments include a React/Leaflet map with adjustable radius and Open-Meteo weather, a separate localhost administrator frontend, a provenance-labelled public polygon API that distinguishes validated structured pending records from operator-verified records, and a PostGIS-backed operator preview and evidence review workflow. Responses carry source details and are schema-validated.

It does **not** yet collect municipal announcements, publish notice geometries, store private apiaries, estimate flowering, send alerts or call an AI provider. There are no legitimate substitutes for those missing integrations. UI states for future functionality must remain clearly identified as future work.

See [Features](../../FEATURES.md) for durable capability names, [Implementation](../../IMPLEMENTATION.md) for the actual code, and [Tests](../../TESTS.md) for verification limits.

## Application separation and delivery principles

- `apps/web` is the beekeeper map, forecast inspection and future private apiary and in-app change indicator. It cannot configure providers or call operator APIs; valid structured source polygons may be visible as explicitly unverified records.
- `apps/admin` is a separate local administrator workspace for source configuration, bounded collection, pending record verification and evidence preview. It shares the Node.js backend and PostgreSQL/PostGIS; it is **not** a new backend service. Internet-facing administration requires future server-side authentication, not a browser-held API key or an assumed protection from the separate frontend.
- Map reloads read local persisted evidence only; they do not fetch Saturn. The next pilot collection strategy (SRC-01/S3c) is a **shared district-scoped cache with a default 24-hour TTL after complete successful retrieval** and a separate administrator force-refresh action. Period-filter and district IDs must be independently verified against the actual portal request contract. The prior whole-region worker (S3b) exists as historical implementation and must be retired as a competing scheduled collection path. A single API page never establishes fresh district coverage.
- Persisted user-specific change events and an in-app polling indicator are preferred over push notification infrastructure in the initial user-alert stage. Exact apiary coordinates remain private. No danger verdict follows automatically from an unverified treatment plan.
- All UI strings must be externalized for localization, and territories/provider filtering must not assume a single national data source.

## 4. Delivery stages

The stages below are **work packages**. They are not feature IDs. A capability can be developed by requirements in several stages; the [cross-reference](../feature-cross-ref.yaml) records those relationships.

### SRC-01 — Collect dependable evidence and show it on the map

**Why this comes first:** without trustworthy, traceable records, more sophisticated map layers or an AI explanation would add presentation without substance.

**What the beekeeper will see**

- An understandable list of data sources, including which sources have been reviewed for use.
- Agricultural treatment notices around a chosen point, with dates, original links and the status of each record.
- A visual difference between an exact published polygon, an approximate area and a place mentioned only in text.
- Honest messages for areas with no published coverage, stale sources or temporarily unavailable services.
- The existing weather inspection, still showing a live source and timestamp.

**What must work behind the screen**

For municipal sources, an operator maintains reviewed access settings. For configured structured treatment feeds, a localhost administrator can initiate a bounded manual fetch without documentary access approval. Bounded retrieval jobs fetch documents, preserve raw revisions and link every parsed field to its evidence. Deduplication protects against repeated downloads; restart-safe run history explains what happened when a job fails. A human review gate controls uncertain or potentially harmful claims. Published observations are searchable by location and time with stable pagination and explicit uncertainty.

The next integration priority is a **configurable FGIS Saturn source**, followed by at least **two independently verified municipal sources** in the pilot. The configured treatment feed may be fetched explicitly from the separate localhost administrator UI using a restricted HTTPS client. Saving provider settings never fetches external data. Source use conditions and region-code mappings require independent verification. The previously added bounded whole-region scheduler is not the approved future pilot path; the S3c district cache and email-message investigation remain planned, not implemented.

**Ready for review when:** real original documents can be followed from the map, operator diagnostics work, repeated/restarted jobs do not duplicate records, and negative security/location/date scenarios pass. This is the currently selected stage.

**Capabilities developed:** `SOURCES.CATALOG`, `SOURCES.DOCUMENT_HISTORY`, `SOURCES.SAFE_FETCH`, `NOTICES.EXTRACTION`, `NOTICES.SPATIAL_PRECISION`, `NOTICES.MAP_OVERLAY`, `WEATHER.POINT_FORECAST`, `MAP.POINT_SELECTION` and early `UX.MOBILE_MAP`.

Normative detail: [SRC-01 sub-specification](subspecs/source-ingestion.md). Execution guidance: [SRC-01 implementation plan](subspecs/source-ingestion-implementation-plan.md).

### BEE-01 — Keep apiaries private while using nearby information

**Why it matters:** a beekeeper wants to inspect their own surroundings repeatedly without publishing precise hive locations.

**What the beekeeper will see**

- Sign-in and a private list or map of their apiaries.
- Add, edit and remove an apiary with a name and precise coordinates.
- Inspect relevant nearby records and choose a radius without exposing the exact site to other users.
- Explicit confirmation before sharing or exporting a location to another service.

**What must work behind the screen**

Authentication is not enough: every read and write must check ownership. PostgreSQL/PostGIS distance queries must use correct coordinate systems and meter-based distances. Logs, model prompts, public maps and URL parameters must not leak another person's private coordinates. We must define retention and deletion semantics before collecting user data.

**Ready for review when:** separate user accounts cannot see or modify each other's apiaries; boundary distances, deletion and access-denied cases pass; the UI behaves correctly on mobile.

**Capability:** `APIARIES.PRIVATE_LOCATIONS`. This stage depends on the trustworthy evidence and query boundaries established in SRC-01.

### AGENT-01 — Read evidence and explain it responsibly

**Why an agent belongs here:** agricultural notices may appear as long pages, inconsistent tables or attachments. A controlled language model can help extract fields and explain conflicting evidence. Its value is in saving review time, not replacing reliable sources.

**What the user or operator will see**

- A suggested structured notice beside the original document, with unclear fields clearly marked.
- A review queue for uncertain, contradictory or high-impact extractions.
- A plain-language answer about an area, with direct citations and an explanation of missing information.
- A visible distinction between extracted text, independently verified facts and the model's interpretation.

**What must work behind the screen**

The **backend** controls every agent run. A configurable provider/model adapter receives bounded inputs and exposes only allowlisted tools. A deterministic orchestrator applies strict output schemas, source-linked excerpts, time/token limits, cancellation, retries and versioned evaluation. Untrusted website text cannot add tools, change instructions or obtain secrets. Unknown pesticide classifications, dates or geometries must remain unknown until independently checked.

**Ready for review when:** held-out real and adversarial documents show acceptable field-level accuracy, citation precision and failure handling; an operator can reject suggestions without publishing them; no AI output can bypass access control.

**Capabilities:** `AGENT.NOTICE_READING`, `AGENT.CITED_EXPLANATION`, and a later extraction method under `NOTICES.EXTRACTION`. Source ingestion can be useful without an LLM.

### SAT-01 — Add vegetation and flowering context

**Why it matters:** finding a potentially useful forage area requires more than a green patch on a map. Land cover, species, weather and seasonal timing must be interpreted together.

**What the beekeeper will see**

- Land-cover categories with data-source attribution and an indication of coverage gaps.
- Possible nectar-producing vegetation distinguished from confirmed species observations.
- Approximate bloom windows expressed as ranges, with region, year and uncertainty.
- A way to compare map context with what a beekeeper sees in the field.

**What must work behind the screen**

Combine properly licensed OpenStreetMap data, documented regional vegetation information and, where justified, satellite imagery. A repeatable geospatial pipeline preserves input dates, resolution, transformations and calibration assumptions. Sentinel-2 or other imagery is useful only where an independently testable method links its observations to a claimed ecological outcome. Collect field observations before calling a flowering estimate reliable.

**Ready for review when:** reproducible spatial transformations, known data gaps, temporal checks and field comparisons support the interpretation; the UI never claims a satellite pixel directly proves nectar availability.

**Capabilities:** `LANDCOVER.EVIDENCE`, `PHENOLOGY.BLOOM_WINDOWS`, with later refinement of `NOTICES.SPATIAL_PRECISION` if additional reference geometry helps.

### ALERT-01 — Monitor an area without constant manual checking

**Why it matters:** useful notices are time-sensitive, and beekeepers should not have to repeat the same searches every day.

**What the user will see**

- Choose an area, date range and kinds of evidence to monitor.
- Review a history of new, updated, dismissed and delivered notifications.
- Understand why a particular notice triggered an alert and when its source was checked.
- Pause or remove a subscription at any time.

**What must work behind the screen**

Evaluate subscriptions against newly reviewed source revisions, not against unverified model guesses. Deduplicate alerts across retries and document updates; retain delivery status, rate limits and privacy boundaries. Delivery channels and their operating cost are selected when this stage starts; no channel is assumed to exist today.

**Ready for review when:** duplicate processing does not send duplicate alerts, stale or uncertain records are labeled, and users can remove subscriptions without lingering deliveries.

**Capability:** `ALERTS.AREA_SUBSCRIPTIONS`.

### MOBILE-01 — Make the product comfortable in the field

**Why it matters:** the beekeeper may use a phone in bright sunlight, with poor connectivity, while moving between locations.

**What the user will see**

- A readable, touch-friendly map, filters and evidence cards on small screens.
- Accessible controls, keyboard navigation and visible loading or failure states.
- Clear behavior when tiles or data services are offline; no silently cached data presented as fresh.
- A simple coordinate handoff to external navigation after URL schemes and waypoint limits are verified.

**What must work behind the screen**

Maintain browser support first. Measure page load, map interaction and network use. Define which records can be cached, their expiry and privacy guarantees. Consider PWA installation or a native wrapper only after field feedback shows value; avoid building two separate client codebases without a reason.

**Ready for review when:** desktop and mobile Playwright flows cover success, empty, failure, retry and navigation; accessibility and constrained-network checks have recorded evidence.

**Capabilities:** `UX.MOBILE_MAP`, plus polish of `MAP.POINT_SELECTION` and `NOTICES.MAP_OVERLAY` developed earlier.

## 5. Sources and their limits

| Candidate source             | What it could contribute                            | What must be checked before use                                                           |
| ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Municipal administrations    | Treatment notices, publication details, attachments | Real availability, reuse terms, dates, content formats and local coverage                 |
| Saturn-related public portal | Plans or related agricultural records               | Actual endpoint, rights, identity, field definitions and update semantics; **unverified** |
| OpenStreetMap / Overpass     | Roads, land use and mapped vegetation context       | Attribution, license, uneven geographic completeness and rate limits                      |
| Open-Meteo                   | Weather forecasts around a coordinate               | Units, timestamps, provider limitations and model-versus-measurement distinction          |
| Copernicus Data Space        | Satellite and land-cover investigation              | Access terms, sensor resolution, processing method and scientific validation              |
| Beekeeper observations       | Local verification and field feedback               | Consent, privacy, location reliability and moderation                                     |

Every published finding must retain its original URL or authoritative dataset, retrieval date, applicable observation/publication date, geographic precision and review state. A source outage must never trigger synthetic production records.

## 6. How the system fits together

We use one repository with two separately deployable applications: `apps/web` (React, TypeScript and Leaflet) and `apps/api` (Node.js, TypeScript and Express). `packages/contracts` owns the shared HTTP schemas. A backend module owns each functional capability; `contract.md` documents what others may call. PostgreSQL/PostGIS stores source evidence, locations and spatial indexes.

Later, background workers can reuse the backend's modules in a separate process. An AI provider is an optional server-side adapter rather than a direct browser dependency. Rust can be considered for proven CPU-heavy spatial or image workloads; it is not required by the initial architecture.

Important conventions:

- HTTP APIs are versioned under `/api/v1` and validate all external data.
- Coordinates are WGS84; meter-based distances use appropriate PostGIS geography operations.
- Time values are normalized to UTC while original source time zones and uncertain dates remain traceable.
- Functional modules use explicit public contracts and avoid circular dependencies or duplicated business rules.
- Source text and LLM responses are untrusted; private apiary coordinates and credentials stay protected.

See [Architecture](../../ARCHITECTURE.md) and [module implementation](../../IMPLEMENTATION.md) for technical detail, rather than repeating it here.

## 7. A practical order of work

| Stage                     | Expected outcome                                      | Solo engineering estimate* |
| ------------------------- | ----------------------------------------------------- | -------------------------: |
| **SRC-01 — current**      | Real municipal notices and traceable source ingestion |             **14–24 days** |
| **BEE-01 — next**         | Account-owned private apiaries                        |              **7–12 days** |
| **AGENT-01 — after that** | Reviewable extraction and cited explanation           |             **10–18 days** |
| SAT-01                    | Evidence-based land-cover and flowering context       |             **12–25 days** |
| ALERT-01                  | Reliable notifications about monitored areas          |              **6–11 days** |
| MOBILE-01                 | Field-ready mobile usability and optional packaging   |              **6–10 days** |

*One focused day means about eight hours of engineering, implementation tests and review preparation. These are **ranges, not commitments**. Source access, licensing, field validation, scientific accuracy and deployment decisions can extend the schedule. Some mobile and security work happens throughout earlier stages rather than waiting for the last stage.

Only SRC-01 has an active, normative sub-specification and a same-directory implementation plan today. Additional child specifications are drafted when selected, based on the actual code and confirmed source conditions. The stage order is a planning baseline, not irrevocable.

## 8. When the MVP is genuinely useful

We should ask the developer to accept the MVP only after a pilot demonstrates the complete journey with **real, properly sourced evidence**. In particular:

1. Approved source documents survive revisions, restarts and failures; important claims link back to the original publication.
2. Time and location filters are accurate, and approximate or unknown locations are never presented as precise.
3. Private apiary data is protected by enforced ownership checks and tested leak boundaries.
4. Weather and environmental evidence are attributed, current enough for their purpose, and honest about model limitations.
5. The agent, if enabled, gives checkable citations, resists hostile source text and routes uncertain extractions to review.
6. A beekeeper can complete the principal map journeys on both desktop and mobile, including errors and recovery.
7. Builds, migrations, test suites and operational recovery can be reproduced with documented commands.

Unit tests alone cannot prove external source rights, scientific validity or field usefulness. These require operator review and actual regional feedback.

**Acceptance belongs to the developer.** Passing checks or merging a patch does not advance the selected stage or archive its specification. The SDD checkpoint is [STATE.json](../STATE.json); coverage gaps and verification rules are documented in [Testing](../../TESTS.md).
