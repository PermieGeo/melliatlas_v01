# Saturn Provider Module Contract

**Owner:** `apps/api/src/modules/sources/providers/saturn/`.

## Responsibility and public boundary

- `index.ts` is the application composition entry point for the explicit Saturn viewport service and its separate local Web/operator routers. Other functional modules must not import provider-private parsers or repositories.
- `SaturnProvider.ts` implements the shared `ViewportIndexProvider` and `DistrictDirectoryProvider` capability ports in [providerPorts.ts](../../providerPorts.ts). It owns the observed `subject=55` query translation and validated response decoding without network or database access.
- `sourceProfile.ts` and `requestProfile.ts` own fixed source identity, endpoint allowlists, and a trusted, non-credential header profile. The generic restricted fetcher requires a registered profile whose source ID and exact URL match before DNS and at every redirect.
- The viewport collection service owns district and revision preflight, checkpoint selection and composition. `saturnViewportPageFetcher.ts` owns the single Saturn HTTP POST and provider-schema validation; its validated response is separately committed by the index repository. The shared [auditedSourceRequest.ts](../../auditedSourceRequest.ts) owns the audited throttle lifecycle for both viewport page collection and explicit directory refresh, without provider URLs or parsing rules.
- `saturnDistrictDirectory.ts` owns explicit directory refresh and cache reads. Index repositories, stored field previews, history and request receipts remain distinct persistence responsibilities.
- `saturnEvidenceLinks.ts` is an inert, offline identity comparison for separately captured map-index IDs, polygon IDs and the minimal `/acr/{id}` response ID. It reports only candidate ID matches, missing entries, repeated exact geometry and ACR URL/body ID discrepancies. It cannot establish a treatment-plan join, a valid spatial relationship or coverage.
- `saturnAcrEvidence.ts` inspects only observed, optional ACR date/product-list/publication shapes and emits structural counts and date-order status; it never outputs source-provided dates, names, substances, dosage or coordinates. Unexpected detail fields remain uninterpreted rather than treated as verified treatment data.
- `saturnCaptureInspection.ts` composes the existing validators into an offline-only identity and ACR-structure report. `saturnCaptureCli.ts` reads bounded, local direct-body captures via `pnpm --dir apps/api evidence:saturn -- ...`; it never makes HTTP or database requests. Its JSON output contains IDs, exact-geometry digests, counts and structural status only, not source-provided names, arbitrary properties or coordinates. The operator must independently verify capture provenance, matching viewport/zoom and dates.
- `saturnCaptureManifest.ts` optionally binds the same local capture files to an operator-authored provenance manifest: raw-byte SHA-256 digests, canonical UTC capture timestamps, fixed captured endpoint paths, the polygon request's `subject`/`callback`, numeric `bbox` and requested ACR IDs. It compares the polygon request rectangle with the validated `/query` viewport and reports `identical`, `overlapping` or `disjoint` without echoing coordinates. `sourceProfile.ts` owns offline-only captured polygon/ACR URLs separately from the outbound transport allowlist. Successful checks establish file integrity and a syntactic viewport comparison against operator-provided metadata, not authenticated origin, capture time, matching treatment identity or spatial coverage.

## Owned data and dependencies

- Saturn-specific tables: `source_saturn_district_catalog`, `source_saturn_request_log`, `source_viewport_index_progress`, `source_viewport_index_pages`, and `source_viewport_index_features`. Their existing migrations 014/015 are immutable.
- Allowed: shared source ports, restricted HTTPS transport, PostgreSQL pool, common source-wide throttle, `@melliatlas/contracts`, Zod and Node standard libraries.
- Forbidden: direct UI-to-provider calls, unbounded retries or parallel fetches, bypassing TLS/DNS/SSRF checks, changing shared source transport for Saturn, calling unrelated modules' private adapters, or treating a map-index row as an observed treatment.

## Behavioral invariants

- Source access is off by default; cached list/status reads do not contact Saturn. Live collection requires explicit permitted operator configuration and a one-page user action.
- Directory entries provide named centers, not district boundaries. A complete viewport pagination checkpoint does not imply full district coverage, valid polygons, treatment details, application dates, 24-hour freshness, or publication permission.
- The `UpdateMap` window is not yet verified as a treatment interval. Retain separate feature IDs and plan IDs, immutable page evidence, and source revision identity.
- An ID match between separately captured viewport results is not proof that two records represent the same treatment or geometry. Keep ACR lookup IDs distinct from returned body IDs and never publish candidate matches as verified polygons.
- A database-backed source-wide minimum request gap applies before every external Saturn call. Each explicit operation records one attempt and one completion status; cache hits and preflight failures do not reserve a source slot. A failed source fetch still consumes its reservation and is never automatically retried. Failure, crash, or pagination inconsistency preserves prior committed evidence.
- The local Web router requires a loopback peer and approved origin; the operator router remains independently restricted. Neither is a production authentication mechanism.

## Extension and verification

The legacy configured treatment-feed parser `beekeeperPlanPage.ts` and its manual ingestion service remain owned by the parent source-ingestion module for now; moving them requires a separate adapter contract and regression tests. Future detail/polygon adapters require independently verified upstream behavior and access/republication rights.

Unit tests cover provider query/response contracts, directory and index validation, denied origins and explicit collection. Isolated PostGIS tests cover restart-safe checkpoints, audit and migration compatibility. No test contacts the real source.
