---
type: ImplementationPlan
title: SRC-01 Source Ingestion Implementation Plan
plan_status: advisory
selected_stage: SRC-01
normative_spec: subspecs/source-ingestion.md
baseline: 2026-10-31 MelliAtlas starter assembled from user-provided reference files; not a Git checkout or test certificate
---

# SRC-01 — Detailed Implementation Plan

**Normative specification:** [Source ingestion](subspecs/source-ingestion.md) · **Umbrella:** [MelliAtlas MVP](spec-melliatlas-mvp.md) · **Checkpoint:** [STATE.json](../STATE.json).

**Status:** Proposed implementation sequence. Refresh file paths, source access, dependencies and test commands against the actual checkout **before execution**. `SRC-01` remains `READY_FOR_IMPLEMENTATION`. This document grants no completion or acceptance.

## A. Existing baseline vs. proposed work

**Implemented in the starter source:**

- `apps/web/src/App.tsx`, `apps/web/src/components/MapCanvas.tsx`, `apps/web/src/api/client.ts`: responsive OSM map, point selection, configurable viewing radius, loading/error/source states.
- `apps/api/src/app.ts`: `/health`, validated `/api/v1/sources` and `/api/v1/locations/inspect`, request IDs and rate limits.
- `apps/api/src/modules/weather/openMeteo.ts`: a bounded live HTTPS weather request with schema validation, UTC timestamps, attribution and typed provider errors.
- `apps/api/src/db/{pool,sourceRepository,migrate}.ts` and `apps/api/migrations/001_source_core.sql`: PostgreSQL/PostGIS source catalog, run ledger, immutable document metadata and indexed observations; explicit migration checksums.
- `packages/contracts/src/index.ts`: typed cross-application HTTP wire schemas.
- Focused API/adapter/UI tests are in source; **their execution is not inferred** until tool output is recorded.

**Not yet implemented:** source-specific municipal adapters, licensed/verified Saturn integration, job runner, document storage/normalization, spatial notice API, overlay UI, operator review workflow, real import history, authenticated admin operations. New files below are **proposals**, not verified owners.

## B. Requirements-to-evidence matrix

| Requirements      | Batches | Required evidence                                                               |
| ----------------- | ------- | ------------------------------------------------------------------------------- |
| SRC-R01, R09      | A, B    | Approved host policy; blocked SSRF/redirect/rate-limit tests                    |
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
