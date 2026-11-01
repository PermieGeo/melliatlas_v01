---
type: ImplementationPlan
title: SRC-01 Source Ingestion Implementation Plan
plan_status: advisory
selected_stage: SRC-01
normative_spec: source-ingestion.md
baseline: 2026-10-31 MelliAtlas starter assembled from user-provided reference files; not a Git checkout or test certificate
---

# SRC-01 — Detailed Implementation Plan

**Normative specification:** [Source ingestion](source-ingestion.md) · **Umbrella:** [MelliAtlas MVP](../spec-umbrella-melliatlas.md) · **Checkpoint:** [STATE.json](../../STATE.json).

**Status:** Proposed implementation sequence. Refresh file paths, source access, dependencies and test commands against the actual checkout **before execution**. `SRC-01` remains `READY_FOR_IMPLEMENTATION`. This document grants no completion or acceptance.

## A. Existing baseline vs. proposed work

**Implemented in the starter source:**

- `apps/web/src/App.tsx`, `apps/web/src/components/MapCanvas.tsx`, `apps/web/src/api/client.ts`: responsive OSM map, point selection, configurable viewing radius, loading/error/source states.
- `apps/api/src/app.ts`: `/health`, validated `/api/v1/sources` and `/api/v1/locations/inspect`, request IDs and rate limits.
- `apps/api/src/modules/weather/openMeteo.ts`: a bounded live HTTPS weather request with schema validation, UTC timestamps, attribution and typed provider errors.
- `apps/api/src/db/{pool,sourceRepository,migrate}.ts` and `apps/api/migrations/001_source_core.sql`: PostgreSQL/PostGIS source catalog, run ledger, immutable document metadata and indexed observations; explicit migration checksums.
- `packages/contracts/src/index.ts`: typed cross-application HTTP wire schemas.
- Focused API/adapter/UI tests are in source; **their execution is not inferred** until tool output is recorded.

**Not yet implemented:** source-specific municipal adapters, licensed/verified Saturn integration, job runner, document storage/normalization, spatial notice API, overlay UI, operator review workflow, real import history, authenticated admin operations. Remaining new files below are **proposals**, not verified owners.

**Incremental groundwork (2026-10-31, pending developer integration):** `apps/api/src/modules/sources/{contracts,destinationPolicy}.ts` and its `contract.md` now define internal domain schemas and an offline destination allowlist preflight, with deterministic tests in `apps/api/test/sourcePolicy.test.ts`. This does not implement step 2 (real source permissions), a database-backed approved registry, DNS/redirect defenses, HTTP fetching or any published notice. Later batches must integrate these contracts with verified source records, and expand the deliberately text-only candidate schema only after geometry validation is implemented. Baseline migration `001_source_core.sql` remains unchanged.

**Registry/migration increment (2026-11-01, pending developer integration):** Additive `apps/api/migrations/002_source_access_registry.sql` extends the catalog without approving existing records and stores append-only policy revisions. A read-only `apps/api/src/modules/sources/municipalSourceRegistry.ts` validates approved records before a future worker can use them. A PostGIS-backed upgrade/history test is wired to CI as `pnpm --dir apps/api test:db`. Source permissions (step 2), authenticated operator edits (step 5), real fetch security (step 6), and user-visible ingestion remain incomplete; do not treat this increment as permission to scrape.

**Module boundary rule:** Every proposed `modules/sources/`, `modules/geo/` or future business module MUST introduce a root `contract.md` with owned data, public entry points, dependencies and invariants. Reuse shared Zod HTTP schemas from `packages/contracts`; put source-specific parsing and persistence inside their owning modules. No cross-module private-table or implementation imports.

## A.1. Priority change — configurable structured provider (2026-11-01)

**Normative requirement:** `SRC-R12` in [source-ingestion.md](source-ingestion.md). **Decision:** implement provider-neutral structured treatment collection first (with the FGIS Saturn prototype as a reference), retain two municipal sources as a later independent coverage requirement. The public portal is documented; the historical prototype's `planapplybees` endpoint and `subject: 55` are **candidate configuration**, not an independently verified public API contract or permission to automate collection. Official Saturn SE-API documentation describes a different integration surface; do not mix provider write/authorization workflows with public bee-portal reads.

**Verified owning paths:** `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/config.ts`, `apps/api/src/modules/sources/{contracts,destinationPolicy,municipalSourceRegistry}.ts`, `apps/api/migrations/001_source_core.sql`, `apps/api/migrations/002_source_access_registry.sql`, `packages/contracts/src/index.ts`, `apps/web/src/{App.tsx,api/client.ts}`. Read real integrations/tests before changes. The compiled snapshot omits the tracked `apps/api/.env.example` contents; do not replace that file based on assumptions.

### S1 — Operator-configurable connection (current increment)

1. Extend the public Zod wire contract with `endpoint`, `method`, `regionParameter`, `regionCode`, bounded flat `parameters` and optimistic `expectedRevision`. Reject unknown fields, region-key collisions, IP literals, plaintext HTTP, URL credentials, fragments and unsafe path encodings. Keep the endpoint a candidate, not an approved access policy.
2. Add `003_saturn_api_configuration.sql` (already delivered, immutable): one `source_catalog` row with kind `treatment`, `under_review`/`pending` access, and `api_request_config` JSONB. Preserve existing `002` registry/history triggers and their append-only revision snapshots; never modify `001` or `002`.
3. Implement `apps/api/src/modules/sources/providerConfiguration.ts`: versioned `get/update`, compare-and-set update on revision, pure `buildProviderRequest(endpoint, settings)` for GET/POST. Do not call fetch, do not store secrets and do not treat this module as a safe transport.
4. Expose `GET/PUT /api/v1/operator/provider` from `apps/api/src/app.ts`; add injected optional backend operator token in `config.ts` and `server.ts`. If no token/owner exists, return 503. Reject missing/wrong bearer token with 401; validate 400, revision conflict 409. Response is no-store, never includes the token.
5. Implement historical `apps/web/src/components/SaturnSettings.tsx` (now replaced by `ProviderSettings.tsx`) and a dedicated navigation tab; keep the operator token only in component memory, disable save until authorized, show `pending` and explicitly state collection is off. `apps/web/src/api/client.ts` validates all wire responses.
6. Test isolated GET/POST request shaping, negative URL/input cases, unauthorized HTTP actions, optimistic concurrency, UI changes, and live PostGIS upgrade/revision behavior. Use no source network during unit tests.

**Completion evidence:** API/React tests, migration tests against real PostGIS, TS checks, no successful collection claim. Failure recovery: if operator token is unset the editor fails closed; a conflict requires reloading; an invalid edit never mutates the database. Roll forward by additive migration, do not roll back a deployed SQL version. The UI is not a full identity management solution; production deployment must secure its operator credential distribution.

**Out-of-sequence provider bootstrap increment (non-acceptance):** migration `006_optional_provider_api_key.sql` adds an optional credential field to the existing source catalog, excluding it from future revision snapshots. `providerSeed.ts` and `db/seedProvider.ts` load operator-selected JSON presets without HTTP access or implicit approval. The default updates only the untouched migration placeholder; deliberate replacement resets access policy and any prior key. Run `pnpm provider:seed:saturn` after migration as a reference setup. Test idempotency, no clobbering of operator edits, and real-PostGIS revision/credential isolation. S2 external API/access verification and S3 durable ingestion are still separate prerequisites.

### S2 — Restricted provider fetch and access decision (next)

1. Investigate current official Saturn portal endpoints and contract with authorized access, exact HTTP examples, rate limits and redistribution conditions. Keep evidence in `docs/source-register.md`, update operator review policy and scope of permitted HTTPS host/path.
2. Generalize access-check semantics to approved `treatment` sources through a **new** SQL migration and narrow public registry interface. `002` currently only permits `municipal_notice` approval. Do not silently bypass this DB check or broaden permissions to arbitrary data sources.
3. Implement `httpFetcher.ts` with DNS resolution and connection pinning, public-address filtering (IPv4 and IPv6), TLS certificate verification, redirect-by-redirect revalidation, content/MIME/response limits, timeouts, controlled concurrency, bounded 429/503 retries and safe proxy behavior.
4. Inject an HTTP transport and resolver for deterministic tests; use fixture responses and blocked private-IP, rebinding, redirect, timeout, decompression and rate-limit tests. No automatic job until reviewed permission, positive tests and transport security all pass.

**Failure and recovery:** an invalid or denied endpoint stays pending; error classifications are persisted to a later run record, not silently retried forever. Access review and permission revocation are operator operations, not UI-controlled bypasses.

### S3 — Configured provider adapter and durable records (following)

1. Implement `TreatmentPlanSourceAdapter` against verified response schemas only, with an injected transport and injected `ProviderRequestSettings`. Preserve pagination and publication-source citations; do not assume `subject: 55` until the live API response is checked.
2. Write immutable raw versions and idempotent ingestion runs to PostGIS before parsing; preserve provider record IDs, date windows, geometry precision and original publication URLs.
3. Normalize `Polygon`/`MultiPolygon` only after CRS and topology validation. Distinguish provisional plans from completed treatments, expired and contradictory records; no synthetic risk score or hazard claims.
4. Add API and map evidence layers behind review, then continue municipal adapters and remaining SRC-01 items. Prove duplicates, changed content, worker crash/restart, rate limits, malformed geometry, and desktop/mobile UI with deterministic tests plus limited permitted live verification.

**Acceptance:** verified live evidence, approved reuse basis, non-public raw audit, map attribution, source freshness and independent developer acceptance. Absence of Saturn notices does not imply absence of spraying.

## B. Requirements-to-evidence matrix

| Requirements      | Batches | Required evidence                                                               |
| ----------------- | ------- | ------------------------------------------------------------------------------- |
| SRC-R01, R09      | A, B    | Approved host policy; blocked SSRF/redirect/rate-limit tests                    |
| SRC-R12           | S1–S3   | Operator configuration + revision, restricted Saturn fetch, cited real evidence |
| SRC-R02, R03, R10 | A, B    | Original URLs and permitted sample documents; idempotent runs and restart tests |
| SRC-R04, R05, R06 | C       | Field-level evidence, ambiguity handling, geometry precision, revision tests    |
| SRC-R07, R08      | D       | Paginated spatial API; real map overlays; mobile E2E tests                      |
| SRC-R11           | A, D    | Valid live weather and synthetic error/contract tests                           |

## C. Ordered implementation work

**Effort unit:** focused solo SDD engineering days (~8 hours), including implementation, verification and review preparation. Estimates assume the bootstrap runs and access to two real sources can be confirmed. External provider/legal research and scientific ground truth may add substantial schedule variance.

### Batch A — Source contract and safe foundation (~3–5 days)

1. **Baseline gate (0.5 d).** Rebuild `packages/contracts`, API and web; run local PostGIS migration; capture test results and file snapshot. Update this plan's verified/proposed list and a small issue log. Verify `apps/api/.env.example` and Node/pnpm/Docker compatibility.
2. **Evidence and permissions (0.5–1.5 d).** Select 2–3 candidate municipal websites from genuinely reachable public administrations. Manually inspect notice pages, attachments, pagination, robots/terms, HTTP behavior and source ownership. Record exact URL examples, content types, document publication dates and access decision in `docs/source-register.md` (proposed). Stop connector implementation for denied/unclear access.
3. **Provider specification (0.5 d).** Define `ApprovedSource`, `FetchPolicy`, `SourceDocument`, `IngestionRun`, `NoticeCandidate` in `apps/api/src/modules/sources/contracts.ts` (proposed) and corresponding public response schemas in `packages/contracts/src/index.ts`. Version the schemas and identify fields whose absence is expected.
4. **Catalog and migration (0.5–1 d).** Extend `apps/api/migrations/001_source_core.sql` via **new** `002_*.sql` migration. Add host/path allowlist, update cadence, reviewer/terms decision, parser version, source cursor and disabled reason. Never edit an already deployed migration; verify upgrade from baseline and fresh database.
5. **Operational source configuration (0.5 d).** Add validated configuration and private operator access design. Changes to registry lifecycle must be authenticated before any public deployment; source URLs must be selected by ID, never accepted as unrestricted user-supplied fetch destinations.

**Batch A gate:** Known allowed source identifiers, validated contracts and migration upgrade path; unknown host and unauthorized source changes fail before network access.

### Batch B — Durable collection pipeline (~4–6 days)

6. **Restricted fetch client (1–1.5 d).** Implement `apps/api/src/modules/sources/httpFetcher.ts` (proposed): TLS, per-source hostname/path allowlists, DNS/private-network checks, redirect revalidation, timeout, byte caps, MIME checks, normalized errors, bounded concurrency and conditional fetch headers. Test malicious redirects, oversized bodies, 429/503, malformed headers, cancellation and disabled sources.
7. **Municipal adapters (1–1.5 d).** Add one adapter per inspected site in `apps/api/src/modules/sources/adapters/` (proposed). Separate discovery/pagination from detail fetch. Persist original source links and metadata; do not invent page selectors or endpoints before live inspection.
8. **Worker and schedule (1–1.5 d).** Add `apps/api/src/worker.ts` plus `modules/sources/ingestScheduler.ts` (proposed), with bounded polling, lease recovery, jittered backoff and shutdown handling. Use database advisory locks or a claim table to prevent simultaneous runs for one source; expose a private single-run operator command for diagnostics.
9. **Immutable raw ingestion (0.5–1 d).** Create a transactional repository `sourceDocumentRepository.ts`: SHA-256, source URL normalization, conditional update handling, immutable versions and one run ledger row per attempt. Preserve original bytes in a controlled store or byte-addressed object storage if volume requires it; do not conflate raw documents and normalized observations.
10. **Failure/restart evidence (0.5–1 d).** Integration tests run against disposable PostGIS. Simulate crash after retrieval, duplicate runs, version changes, failed adapter, retry exhaustion, aborted requests and independent process restart; assert no untracked published result.

**Batch B gate:** At least two permitted sources run automatically, retain provenance, remain idempotent, and provide operator-readable failure information.

### Batch C — Evidence extraction and geospatial normalization (~4–6 days)

11. **Deterministic document parsing (1–1.5 d).** Add `modules/sources/parseMunicipalNotice.ts` with HTML/content sanitization, publication date/author extraction, source excerpt offsets and strict field schema. Support verified text/PDF variants only when the chosen real sources require them; route unsupported scans to pending review.
12. **Notice domain model (0.5–1 d).** Map dates and restriction phrases into versioned `NoticeCandidate` records. Avoid inferring active ingredients, legal thresholds or treatment safety from a product name alone. Reject impossible dates and contradictory intervals; keep uncertain parts nullable.
13. **Spatial evidence handling (1–1.5 d).** Add `modules/geo/normalizeGeometry.ts` (proposed): validate CRS, polygon topology and area bounds, record centroid-only lookup as approximate, and preserve text-only locations. Use PostGIS `ST_Intersects`/`ST_DWithin` only with honest precision and indexed geometries.
14. **Dedup, conflict and review state (1–1.5 d).** Extend observation repository and migration via `003_*.sql` for document-revision linkage, stable identity keys, source excerpt links and reviewer actions. Treat contradictory editions as separate auditable candidate versions. Public data excludes rejected/pending high-impact claims.
15. **Fixture and corpus tests (0.5–1 d).** Maintain anonymized, legally retainable HTML/PDF fixtures, including conflicting dates, place-name ambiguity, missing issuer, duplicates, prompt injection, malformed geometry and explicit source precision. Record field-level extraction quality on a small held-out corpus.

**Batch C gate:** No displayed claim lacks source provenance; uncertain geometry/dates remain visibly uncertain; all revisions and decisions survive restart.

### Batch D — Public evidence API and map integration (~4–6 days)

16. **Spatial notices API (1–1.5 d).** Add `apps/api/src/routes/notices.ts` and query/repository layer (proposed), versioned Zod contracts, paginated bbox/date filters, strict caps, indexed PostGIS query plans, status/freshness fields, typed 400/503 responses. Query only reviewed records and expose no private coordinates.
17. **Real map overlays (1–1.5 d).** Extend `apps/web/src/components/MapCanvas.tsx`, `App.tsx` and `src/api/client.ts`: request view-bounded features on intentional filter/pan changes; draw exact/approximate geometries distinctly; provide notice detail and original link; support mobile hit targets, loading/stale/empty/error states and request cancellation.
18. **Diagnostics and resilience (0.5–1 d).** Add structured logs (without personal coordinates/raw document secrets), ingestion counters, source freshness endpoints with private operator gate, worker liveness/readiness and runbook `docs/operations.md` (proposed). Prove outage retains reviewed snapshot without inventing new observations.
19. **Independent acceptance suite (1–1.5 d).** Run format, typecheck, unit, source-adapter, PostGIS integration, migration-upgrade, API contract, Playwright desktop/mobile and bounded-load tests. Cover SRC-T01–T11, restart, private address blocking and large spatial queries; capture executed commands/results separately from desired evidence.
20. **Developer review and handoff (0.5 d).** Present two real source examples, raw-document links, an end-to-end map trace and unresolved permission/coverage/science risks. Keep `STATE.json` unchanged until the developer explicitly sets a review/acceptance boundary. Archive the child and plan together only after complete acceptance.

**Total planning range: ~15–23 focused days**, before access/legal blockers, unrelated platform hardening or new research claims. At 2–4 focused hours per day this is approximately 6–12 calendar working weeks for this sub-spec alone. Revise after source discovery (step 2).

## D. Failure, privacy, migration and deployment decisions

- **Rollback:** Deploy additive DB migrations before new readers/writers. Disable source adapter by configuration to stop a faulty ingestion; keep raw versions and published revisions for audit. Production schema downgrades require an explicit restore/roll-forward plan.
- **Concurrency:** One lease per source, idempotent hash/revision upsert and short transactions. Expired leases and interrupted workers are retried with preserved run IDs and error categories.
- **Source failures:** A timeout/429/invalid document creates a failed/partial run, never a synthetic notice. Retain older verified records with staleness markers subject to policy.
- **Access:** Preserve original terms and attribution; public website visibility is not proof of unrestricted automated collection or redistribution. Confirm the public Saturn endpoint separately before adding it.
- **Security:** Restrict callbacks and downloads; no dynamic URL fetch by model text, browser parameter or third-party HTML. Scan/validate attachments as bytes and limit parser complexity.
- **Privacy:** Precise apiary data is outside SRC-01 storage/API and must not be accidentally introduced into public map telemetry or ingestion logs.
- **Scientific limits:** Show source-published observations and spatial uncertainty. Risk scoring, pesticide drift, crop classification and legal-safe spraying windows require later independently validated feature scopes.

## E. Checks and expected artifacts

```bash
python3 tools/specs/validate_state.py
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
docker compose up -d db
pnpm db:migrate
pnpm e2e
```

Extend the commands with real PostGIS integration tests and bounded-load checks in Batch D. Record output, DB version and source URLs actually tested. A clean TypeScript build alone cannot prove source permissions, field-level extraction quality, environmental validity or developer acceptance.

### S1b — Provider-neutral configuration and reference response research (2026-11-01)

**Scope:** Implements the provider-neutral extension of `SRC-R12`; does not complete `S2` or `S3`.

1. Add immutable `004_provider_connection.sql` after migrations 001–003; copy existing candidate request settings to the neutral `treatment-feed` row without approval, disable legacy source and preserve immutable history. Verify both clean and upgraded databases.
2. Rename `saturnConfiguration.ts` to `providerConfiguration.ts`; expose `ProviderConfigurationRepository` and `buildProviderRequest`. Persist operator-editable provider name and endpoint; restrict JSON nesting, size and forbidden key names. Keep revision compare-and-set.
3. Rename operator route to `/api/v1/operator/provider` and UI to `ProviderSettings.tsx`. Use `SOURCE_OPERATOR_TOKEN` with the previously deployed token setting as a compatibility fallback; never leak either value. New UI text uses only generic provider vocabulary.
4. Support `regionContainer` so the archived prototype's `beekeperSearchFilter.subject` can be assembled without any fixed provider URL. Do not make authenticated external calls, automatically approve hostnames or enable ingestion.
5. Add `beekeeperPlanPage.ts` as a pure response parser for the reference `content`/`beeAcreage`/`allPatList` shape. Preserve null for absent fields; reject invalid geometries. Avoid synthetic hazard, satellite, treatment, or temporal data.
6. Update cross-references and module contracts; independently test nested request body, authorization, revision history and parser boundaries. No new ingestion worker, credentials, map layers or trusted notice status.

**Failure/recovery:** A partial migration fails transactionally and leaves migration 003 intact. Old candidate configuration remains auditable; the new feed is disabled for collection. An invalid request or response fails without side effects. `S2` must independently verify provider terms and secure network behavior; `S3` will handle versioned storage, normalizing shape and review.

### S2 implementation increment — restricted retrieval foundation (2026-11-01)

1. Extend internal source policy contracts to allow an explicitly reviewed `treatment` source and `application/json`; add `005_treatment_source_approval.sql` to relax `002` only for a treatment feed with stored request configuration and full review evidence. Existing candidates remain pending. Never modify an applied migration.
2. Change `ApprovedSourceRegistry.getApproved()` to read both municipal and treatment sources using the same strict review schema. Retain `MunicipalSourceRegistry` as a compatibility alias for existing callers.
3. Implement `RestrictedSourceFetcher` as a non-routed, non-scheduled service. Validate an approved source and allowed HTTPS destination before resolution; reject special-use DNS answers, pin the selected address into the TLS dial, check the connected peer, verify certificates and revalidate redirects. Enforce no proxy, no implicit decompression, MIME and response limits, timeouts, bounded retries, and a fixed per-instance concurrency/rate gate.
4. Any authenticated configuration change invalidates earlier source approval (`pending`, `under_review`, cleared allowed locations, reviewer evidence and policy). Manual reapproval requires independent evidence; the public UI must not approve its own endpoint.
5. Add synthetic unit tests for allowlist and DNS failures, redirects, status retries, MIME, compression, abort, request limits and concurrency; add a real PostGIS migration/approval/revocation test. Confirm that no provider network call is wired from `server.ts`, browser or background jobs.

**Limits/gate:** This increment does not prove permission to scrape or republish from the candidate portal and does not implement actual ingestion. The published public portal UI and earlier prototype are not proof of a supported backend API. Source response format, real credentials (if any), rate limits and legal basis are unresolved. Before S3, perform an operator-approved live contract probe with a permitted account/environment, document request/response and source revisions, then add durable raw storage and restart-safe adapter tests.

### S3a — Operator-gated one-page ingestion, review and map projection (2026-11-01)

**Objective / requirements:** Implement the first verifiable structured-provider path for `SRC-R03`, `SRC-R05`, `SRC-R07`, `SRC-R08`, `SRC-R10`, `SRC-R12` without claiming the complete S3 worker/pagination coverage. Prerequisites: S2 transport, database migrations 001–006, a candidate record created by the seed. The operator is responsible for independently validating automated access/reuse terms before approving a connection.

1. **Migration:** Add `apps/api/migrations/007_treatment_observation_dedupe.sql` for document-version/record index uniqueness and append-only operator decision evidence. Existing migrations remain unchanged; old pending candidates are not automatically verified. A failed migration rolls back transactionally.
2. **Backend source adapter:** Add `apps/api/src/modules/sources/treatmentIngestion.ts` as owner for explicit access review, one-page collection, candidate publication decisions and bounded spatial query. Its public API accepts an injected `RestrictedSourceFetcher` to guarantee deterministic offline tests. Approval derives the allowed HTTPS host/path and conservative fetch limits from the stored endpoint. No permission evidence may be inferred from mere public availability.
3. **Network and transaction workflow:** Require an approved `ApprovedSourceRegistry` entry; validate parsed connection and its registry revision. Acquire a session-level PostgreSQL advisory lock, begin a durable `ingestion_runs` row, call `buildProviderRequest` with a bounded page cursor, fetch with TLS/DNS pinning from S2 and parse `content`/`beeAcreage`/`allPatList`. Inside a short transaction, recheck the registry revision, store the original raw page by `(source_id, canonical_url, sha256)`, extract candidates idempotently and update run/cursor/freshness. On failure, mark the run failed without advancing the cursor; unlock in `finally`. Do not expose raw private source payloads to public routes.
4. **Geometry:** Only accept source-supplied Polygon/MultiPolygon WGS84 coordinates with closed rings and bounded point count; additionally validate topology with PostGIS `ST_IsValid`. Invalid/missing geometry persists as `text_only` pending evidence and cannot be published as an exact field. Never synthesize coordinates, classification, risk or missing dates.
5. **Operator review boundary:** Add authenticated, token-protected access review, manual fetch, pending candidates and verified/rejected decision routes in `apps/api/src/app.ts`. A successful decision needs a reviewer identity and substantial evidence note. Database enforces one immutable decision per observation. Reconfiguration continues to revoke access using the existing provider policy logic. Keep external requests exclusively on explicit operator-triggered sync.
6. **Public API and map:** Add `GET /api/v1/notices` with optional validated WGS84 bbox and an upper result bound. Only verified polygons are returned with source names, URLs, timestamps, and source-stated attributes. Extend `packages/contracts/src/index.ts`, `apps/web/src/api/client.ts`, `apps/web/src/components/MapCanvas.tsx`, and `apps/web/src/App.tsx` to draw polygons with provenance and distinguish no reviewed data from loading/error. Extend `ProviderSettings.tsx` with explicit review and sync controls; never expose the bearer token in storage or public queries.
7. **Tests:** Add synthetic unit geometry tests and an isolated real-PostGIS ingestion test covering no-approval failure before network, raw documents, pending visibility, verified publication, bbox filtering, duplicate ingestion and review history. Add HTTP boundary tests for authorization and malformed bbox. Stub all remote provider calls; no public network is required. Before acceptance run `python3 tools/specs/validate_state.py`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:migrate`, `pnpm --dir apps/api test:db`, `pnpm e2e` and desktop/mobile inspection where available.
8. **Recovery/rollout:** Apply migration 007 before server deployment. For invalid provider payloads retain failed ingestion-run status and keep the last reviewed map layer; for changed access review reject in-flight publication. Disable the provider connection through policy to stop new fetches without erasing immutable raw evidence. Paginate further by repeated _operator-triggered_ page requests; throttle to the reviewed 60-second interval. This increment does not include a background scheduler, a globally stable current-revision projector, or automated retractions/conflict resolution. No user-visible safety verdict is inferred.

**Completion evidence and limits:** Synthetic fake-fetcher and real PostGIS tests must pass, public API must not reveal pending items, and each displayed polygon must correspond to a verified candidate and stored source document. A real endpoint smoke test, legal reuse authorization, large-region coverage and complete S3 acceptance remain separate gates; `STATE.json` is developer-controlled and stays unchanged.

### S3a.1 — Remove documentary access-approval workflow for manual treatment retrieval (2026-11-01)

**Normative link:** [SRC-01 requirements](source-ingestion.md), updated SRC-R12 and SRC-T17–T19. **Prerequisites:** implemented S3a, migrations 001–007, source settings and token-backed operator routes.

1. Add immutable migration 008: promote only matching configured `treatment-feed` rows from `under_review` to `configured`; preserve legacy access-decision columns and immutable review records. `pnpm db:migrate` must remain idempotent and checksum-checked. Disabled and mismatched rows are not promoted.
2. Configure new/edited treatment connections directly in `providerSeed.ts` and `ProviderConfigurationRepository`; retain endpoint validation, revision conflict checks and credential clearing. Do not infer provider terms or issue background HTTP requests.
3. In `treatmentIngestion.ts`, replace mandatory `ApprovedSourceRegistry` use with a narrow technical fetch registration derived from the persisted endpoint. Check configured lifecycle, exact endpoint correspondence and registry revision before/after fetch. The S2 `RestrictedSourceFetcher` and `destinationPolicy` must accept the `configured` decision **only** for `treatment` sources; municipal registration still requires independent approval.
4. Delete the `/api/v1/operator/provider/approve` route and the operator permission form/client method. Keep bearer authentication for `POST /operator/provider/sync`, status and candidate review. Replace access-decision status UI with source-configured status and show the fetch button without approval.
5. Keep `source_documents`, `ingestion_runs`, `source_observations` and individual reviewer decisions unchanged. Public `GET /api/v1/notices` still returns only verified valid polygons, provided the treatment source remains configured.
6. Add negative tests for anonymous sync, unconfigured treatment and configured-but-unreviewed municipal sources; add positive tests for configured treatment fetch and UI. Update isolated PostGIS migration tests and runbooks, then execute `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm --dir apps/api test:db`, `pnpm e2e` via `./run-tests.sh` on a local prepared environment.

**Failure/recovery:** An invalid configured endpoint is refused before DNS. A source edited during fetching fails the revision check without committing observations. A failed fetch records a failed run with a stable code, leaves the cursor untouched and does not publish pending records. Migration 008 is a one-time additive upgrade; rollback is a new migration, never an edit to an applied SQL file.

**Remaining risks:** The reference external endpoint's current JSON contract and reuse conditions have not been independently verified. `SOURCE_OPERATOR_TOKEN` must be configured for operator actions. Existing legacy access metadata is intentionally retained for compatibility, not used as a treatment-fetch gate.

### S3a migration recovery — legacy Saturn URL reconciliation

**Verified state:** `004_provider_connection.sql` copied the legacy `saturn.url` homepage to `treatment-feed.url` but retained the full API path inside `api_request_config.endpoint`. Consequently, `008_manual_treatment_fetch.sql` does not activate the untouched installation, because it requires matching URLs. The migration file `008` must remain unchanged for checksummed installations.

1. **Database repair:** Add `apps/api/migrations/009_legacy_treatment_endpoint_alignment.sql`, matching the exact legacy source ID, name, HTTPS homepage, request JSON, pending state, null credential, and unmodified cursor. Update only the stored URL and lifecycle; preserve historical permissions, audit snapshots, and source metadata. Do not adopt arbitrary mismatched operator URLs.
2. **PostGIS upgrade regression:** Extend `apps/api/integration/manualTreatmentMigration.test.ts` to apply 001–007, verify that 008 alone leaves the legacy row untouched, and that 009 activates only the known bootstrap. Repeat both for idempotency; prove disabled, mismatched, and customized rows are unaffected, and that 008 still activates an already aligned endpoint.
3. **Execution order:** After applying the follow-up PATCH to the existing uncommitted feature branch, run `pnpm format`, `pnpm --dir apps/api test:db`, and the canonical `apatch` CHK. On successful merge/restart, run `pnpm db:migrate` to apply 009 to the application database. `CHK` uses isolated test schemas and does not itself apply migration 009 to the application's public schema.
4. **Recovery:** If an operator customized the stored URL, the conservative 009 match intentionally leaves it unchanged. An authorized operator must review and save the correct provider endpoint through the existing settings UI. Do not edit migration 008, rewrite migration checksums, insert fabricated permission evidence, or force-update disabled sources.

**Acceptance evidence:** The real PostGIS migration tests pass; the legacy `treatment-feed` has equal `url` and `api_request_config.endpoint`, lifecycle `configured`, and `access_decision` still `pending`; the explicit manual sync remains token-authenticated. No claim is made about successful contact with the external provider until a real authorized request is observed.

### S3a.2 — Local administrator configuration and unverified map preview

**Linked normative spec:** [Local administrator preview increment](source-ingestion.md#local-administrator-preview-increment-2026-11-01). **Verified prerequisites:** configured `treatment-feed`, migrations 001–009, S2 restricted fetcher, S3a ingestion and map layer. This stage intentionally makes no SQL schema change.

1. **API security boundary:** In `apps/api/src/server.ts`, bind Express to `127.0.0.1` only. In `apps/api/src/app.ts` remove browser bearer authorization and reject non-local `Origin` headers on administrator routes; preserve structured errors, rate limits, no-store headers, and strict Zod validation. Do not expose the service via a public interface or reverse proxy. The separate client app must not use these routes.
2. **Map preview query:** In `apps/api/src/modules/sources/treatmentIngestion.ts`, keep `published()` verified-only and add `preview()` for validated `pending` and `verified` geometries. Reuse the same bounded PostGIS projection and enforce configured source plus exact document endpoint association. Never emit `rejected`, malformed or text-only geometry. Preserve all original source URLs and observation timestamps.
3. **Client contracts:** Extend optional `reviewStatus` in `packages/contracts/src/index.ts` while preserving the public response shape. Point the administrator map client in `apps/web/src/api/client.ts` at `/api/v1/operator/notices/map-preview`. In `MapCanvas.tsx`, label pending overlays explicitly as unverified and draw dashed borders; keep verified styling and source links. In `App.tsx`, show accurate map counts and refresh on import.
4. **Settings workflow:** In `ProviderSettings.tsx`, load config and status on mount, remove token input and Open button, perform revision-checked save, then issue exactly one bounded sync. Show saved/failed-fetch separately, refresh statuses and the map layer on successful sync. Keep manual retry and separate human review for public publication. Do not hide upstream failures.
5. **Standalone diagnostic:** Add `scripts/check-saturn-api.mjs` reading the committed reference preset. Send one capped, timeout-bound HTTPS POST with page size 1; output status, content shape, counts and no private records. Assert request construction and response handling in `scripts/check-saturn-api.test.mjs` using injected `fetch`, and call the offline tests from `run-tests.sh`. Live checks are optional manual diagnostics and do not belong to the deterministic CI suite.
6. **Regression and acceptance:** Update `apps/api/test/app.test.ts`, `apps/api/integration/treatmentIngestion.test.ts`, `apps/web/src/components/ProviderSettings.test.tsx`, `apps/web/src/App.test.tsx` and `tests/e2e/map.spec.ts`; confirm no bearer dependency, CSRF origin rejection, pending preview, public filtering, no fabricated geometry and save failure recovery. Run `pnpm format`, `apatch CHK` with local PostGIS and Chromium, then manually run `node scripts/check-saturn-api.mjs` from a network-enabled workstation. Confirm the live provider response before declaring external API functionality.

**Recovery and risks:** On upstream failure retain saved settings and show error; on invalid geometry retain text-only evidence without rendering. Pending layers are never published by the public endpoint. If internet exposure is needed, deploy a separately authenticated admin gateway and a distinct read-only public client; the localhost-only no-token implementation must not be used directly. Snapshot metadata identifies source commit `8048876215fdfcd81a16ccac7d7484dfd47ba2f6` plus successive S3a overlays through the 009 repair.
