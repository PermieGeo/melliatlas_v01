---
type: SubSpecification
title: Source Ingestion and Evidence Map
spec_status: draft
owner: SRC
selected_stage: SRC-01
parent: ../spec-umbrella-melliatlas.md
implementation_plan: source-ingestion-implementation-plan.md
---

# SRC-01 — Source Ingestion and Evidence Map

**Parent:** [MelliAtlas MVP](../spec-umbrella-melliatlas.md) · **Plan:** [SRC-01 implementation plan](source-ingestion-implementation-plan.md) · **State:** [STATE.json](../../STATE.json).

## 1. User outcome

A beekeeper selects an area in Smolensk Oblast and sees **actual published notices and geospatial context**, with links to their original sources, understandable dates and honest location precision. The operator can inspect ingestion status, rejected records and source access settings. The first usable slice already includes a live map and server-side Open-Meteo location inspection; this sub-spec completes the durable source pipeline and evidence layer.

## 2. Scope and requirements

| ID      | Requirement                                                                                                                                                                         | Observable acceptance                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SRC-R01 | Maintain a versioned, operator-controlled source catalog with names, allowed hosts, access terms, refresh policy, enabled state and data purpose                                    | Unknown/unreviewed hosts cannot start a job; catalog exposes only public metadata                       |
| SRC-R02 | Ingest at least two **independently verified, publicly accessible** municipal notice sources in the pilot region                                                                    | New/updated real notices are retrieved and directly linked; blocked sources report an actionable reason |
| SRC-R03 | Store immutable raw source documents and durable run records, including source URL, fetch time, content hash, content type, publication time where known, status and error category | Re-fetch and process restart preserve one canonical version and auditable run history                   |
| SRC-R04 | Parse publication metadata, notice dates, place names, crop, treatment subject and source-stated restrictions into a strict normalized schema                                       | Every parsed claim can be traced to a source excerpt; ambiguous fields remain null/pending              |
| SRC-R05 | Normalize explicitly supplied geometry to WGS84/PostGIS; preserve `exact_polygon`, `approximate_area` or `text_only` accuracy                                                       | A notice with only a village name cannot appear as an exact field polygon                               |
| SRC-R06 | Distinguish future, current, expired and unclear notice windows; retain revisions and conflicting notices without suppressing evidence                                              | Same URL revisions are preserved; only confirmed calendar windows receive a temporal label              |
| SRC-R07 | Publish source-backed, reviewed observations via paginated spatial/time-filtered `/api/v1` endpoints, with source attribution and freshness                                         | Invalid bbox/time windows fail 400; database outage fails 503; no fabricated fallback records           |
| SRC-R08 | Render published notice geometries/approximate regions on a map; allow source navigation and filters by time/review state                                                           | Desktop and mobile map show the same verified records and distinguish approximate shapes                |
| SRC-R09 | Bound source fetch duration, payload size, concurrency, network destination, retry count and cache staleness                                                                        | Redirect to a private IP, oversized body, timeouts and rate limits fail closed and are recorded         |
| SRC-R10 | Expose job diagnostics for the operator: last attempt/success, item counts, failures and selected source version                                                                    | Repeated jobs and server restarts do not lose status or duplicate current observations                  |
| SRC-R11 | Preserve bootstrap Open-Meteo location inspection as a real, independently attributed forecast endpoint                                                                             | Valid coordinates succeed with a real provider; invalid/malformed/offline cases return typed errors     |
| SRC-R12 | Prioritize a configurable structured treatment-plan provider ahead of municipal adapters. Accept a provider label, HTTPS endpoint, HTTP method, nested region field/code and bounded JSON request parameters through authenticated operator UI and typed programmatic inputs. Persist settings with revisions, but keep collection off until reviewed access and a safe fetcher exist. | Unauthorized edits fail; concurrent writes do not overwrite configuration; tests inject request settings without network; no unreviewed endpoint triggers retrieval. |

**Source acquisition gate:** The structured treatment feed illustrated by the FGIS Saturn reference archive is the **first integration priority**, followed by the two independently verified municipal notice sources required by `SRC-R02`. Public Beekeeper Portal browsing is reported as unauthenticated, but the reference `POST https://bee-saturn.ru/backend/beemaster/planapplybees` endpoint, request schema and automated-reuse permission remain provisional. An operator may save a candidate endpoint without granting network permission. No collection or publication begins until access review, a restricted transport, and evidence validation have passed. User-visible records must correspond to inspected original documents.

## 3. API and persistent data

**Verified bootstrap:**

- `GET /health/live`, `GET /health/ready`.
- `GET /api/v1/sources` reads the configured source catalog.
- `GET /api/v1/locations/inspect?lat&lon` retrieves Open-Meteo values, WGS84 coordinate echo, forecast-model provenance and UTC times.
- `apps/api/migrations/001_source_core.sql` defines the initial source catalog, ingestion runs, source documents and spatial observation tables.

**Authenticated operator configuration slice (no collection):**

- `GET /api/v1/operator/provider` reads the candidate provider label, endpoint, request method/region/parameters and registry revision; `PUT /api/v1/operator/provider` accepts a complete validated configuration and `expectedRevision`, returning 409 on conflict. Both require an operator bearer token configured server-side and return 503 if disabled. No credentials are persisted in browser storage or included in responses.
- `apps/api/migrations/003_saturn_api_configuration.sql` is immutable historical bootstrap. Migration `004_provider_connection.sql` creates a provider-neutral pending `treatment-feed` configuration and disables the legacy record without removing history. The registry's existing approval gate does not grant Saturn network access; a future additive change must explicitly support reviewed treatment sources.
- `buildProviderRequest` is a pure programmatic interface accepting the endpoint and typed JSON request parameters, including nested region filters; it sends no network requests and makes no authorization decisions. `parseBeekeeperPlanPage` is a separate reference-shape parser and never claims records are verified or safe to publish.

**Planned endpoints for this stage:**

- `GET /api/v1/notices?bbox=minLon,minLat,maxLon,maxLat&from=...&to=...&cursor=...` returns **reviewed** notice summaries and geometries with bounded pagination and stable IDs.
- `GET /api/v1/notices/:id` returns the original citation, publication/update timestamps, extracted fields, geometry precision and review history visible to the authorized user.
- `GET /api/v1/sources/:id/status` returns operator-readable fetch/ingestion diagnostics, access-restriction information and last success; access control must be added before sensitive operational detail is exposed.

**Normalized notice:** `id`, `sourceDocumentId`, `sourceId`, `canonicalUrl`, `publishedAt?`, `retrievedAt`, `effectiveFrom?`, `effectiveTo?`, `locationText?`, `geometry?`, `spatialPrecision`, `crop?`, `substanceAsPublished?`, `reviewStatus`, `extractionMethod`, `sourceVersion`, `dataQualityFlags[]`. A missing `effectiveTo` or unknown geometry stays explicit. Store no inferred pesticide hazard class without a separately verified product reference.

**Persistence:** Keep raw document versions immutable; deduplicate identical `(sourceId, canonicalUrl, sha256)` downloads. A new hash is a new revision. A normalized observation references its exact document version, uses transaction-safe publication, and can be superseded without deleting history. Reserve a unique job claim/lease for worker concurrency. Geometry is indexed with GiST; notice time ranges with B-tree/GiST as measured.

## 4. Ingestion behavior

1. Source registry approves a source, access method, allowed domains, quota and parser version.
2. Scheduler leases an eligible source, records a run and fetches documents with an allowlisted client.
3. Raw payload, metadata and content hash are committed before extraction. Duplicate content is recognized without losing run evidence.
4. Deterministic HTML parsing extracts publication metadata; strict schema normalization records field-level evidence. Scanned attachments that need OCR remain pending with an explicit reason until a reviewed extractor is available.
5. Spatial normalization uses only published polygon geometry or documented place/area resolution with its precision. Ambiguous locations are `text_only`.
6. Review policy determines whether an observation is published. A pending model-extracted claim is not a verified notice.
7. The API reads a stable, paginated snapshot; the UI shows findings with original links and timestamps.

## 5. Security and data-quality boundaries

- Fetch accepts only pre-registered HTTPS hosts and explicitly approved paths. Resolve and check DNS/redirect targets, block loopback/link-local/private address ranges and cloud metadata endpoints, cap response bytes and MIME types.
- Treat source HTML/PDF as untrusted data; strip active content, do not execute embedded scripts, and do not allow document text to control fetch tools or operator configuration.
- No public endpoint triggers unbounded scraping. Operator configuration changes require server-side bearer authorization, no-store responses and revision checks. For production rollout, operator authentication must be evaluated against deployment security requirements; setting a candidate URL never grants fetch permission.
- Keep secrets and private apiary positions outside raw source artifacts, model prompts and source API responses.
- Provider rate limits and terms take priority over requested polling cadence. Failed and partially successful runs remain inspectable.
- Show source coverage and quality flags; do not equate absence of a notice with absence of agricultural treatment.

## 6. Independent test scenarios

| ID      | Scenario                                                                  | Expected behavior                                                                              |
| ------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| SRC-T01 | Valid source HTML, correctly dated notice, explicit polygon               | Exactly one linked candidate with preserved source version and geometry                        |
| SRC-T02 | Same document fetched repeatedly and worker restarted                     | No duplicate published observation; successful no-op or idempotent revision handling           |
| SRC-T03 | URL changes content, ambiguous dates, contradictory editions              | Revision history preserved; new ambiguous candidate pending review                             |
| SRC-T04 | Notice mentions a village only                                            | Approximate or text-only geometry; never an exact parcel                                       |
| SRC-T05 | Host redirects to private network, returns oversized content or times out | Blocked/bounded fetch; sanitized error; no candidate published                                 |
| SRC-T06 | Source unavailable, malformed HTML, unsupported attachment                | Source failure/pending state; no fabricated records; previous snapshot retains freshness label |
| SRC-T07 | Invalid bbox/date/cursor, large area or malformed query                   | 400 with typed code and bounded work; no database mutation                                     |
| SRC-T08 | API/worker restarted after partial transaction                            | No orphan published observation; resumable or failed run ledger                                |
| SRC-T09 | Mobile touch and desktop click on genuine map results                     | Details and source links work; approximate precision is visually distinct                      |
| SRC-T10 | Source data contains instructions targeting the AI/parser/worker          | Content stored as evidence, never executed or granted privileges                               |
| SRC-T11 | Open-Meteo malformed response, outage or invalid lat/lon                  | Typed 503/400; no fake weather, no leaked upstream stack trace                                 |

### Provider configuration coverage

- **SRC-T12:** Unauthorized or missing operator credentials cannot read or mutate settings; no configured token fails closed.
- **SRC-T13:** A valid operator change persists across reads with a monotonic revision; a stale revision returns 409 and leaves the latest record intact.
- **SRC-T14:** Programmatic GET/POST request construction accepts an explicit region and bounded parameters; invalid URL, reserved/duplicate region key, malformed fields and IP-literal endpoints fail validation. Constructing a request does not fetch any data.
- **SRC-T15 (future):** A reviewed Saturn source safely fetches, parses and retains real records with original published evidence; re-fetch and unsafe DNS/redirect attempts obey SRC-R03 and SRC-R09.

## 7. Completion gate

`SRC-01` is eligible for developer acceptance when two authorized municipal sources have been ingested from actual documents, map output and source links can be inspected, migration/restart/idempotency/provider-failure tests pass, Playwright desktop/mobile scenarios pass, and the operator has reviewed coverage and source restrictions. Record real command outputs and representative source evidence. A generated scaffold is **not** a completed SRC-01 stage.
