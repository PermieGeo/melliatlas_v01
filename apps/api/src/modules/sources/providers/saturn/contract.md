# Saturn Provider Module Contract

**Owner:** `apps/api/src/modules/sources/providers/saturn/`.

## Responsibility and public boundary

- `index.ts` is the application composition entry point for the explicit Saturn viewport service and its separate local Web/operator routers. Other functional modules must not import provider-private parsers or repositories.
- `SaturnProvider.ts` implements the shared `ViewportIndexProvider` and `DistrictDirectoryProvider` capability ports in [providerPorts.ts](../../providerPorts.ts). It owns the observed `subject=55` query translation and validated response decoding without network or database access.
- `sourceProfile.ts` and `requestProfile.ts` own fixed source identity, endpoint allowlists, and a trusted, non-credential header profile. The generic restricted fetcher requires a registered profile whose source ID and exact URL match before DNS and at every redirect.
- The viewport collection service owns explicit one-page orchestration, dependency injection, source revision checks, shared throttling, request audit, and persisted progress. `saturnDistrictDirectory.ts` owns explicit directory refresh and cache reads. Index repositories, stored field previews, history and request receipts remain distinct persistence responsibilities.

## Owned data and dependencies

- Saturn-specific tables: `source_saturn_district_catalog`, `source_saturn_request_log`, `source_viewport_index_progress`, `source_viewport_index_pages`, and `source_viewport_index_features`. Their existing migrations 014/015 are immutable.
- Allowed: shared source ports, restricted HTTPS transport, PostgreSQL pool, common source-wide throttle, `@melliatlas/contracts`, Zod and Node standard libraries.
- Forbidden: direct UI-to-provider calls, unbounded retries or parallel fetches, bypassing TLS/DNS/SSRF checks, changing shared source transport for Saturn, calling unrelated modules' private adapters, or treating a map-index row as an observed treatment.

## Behavioral invariants

- Source access is off by default; cached list/status reads do not contact Saturn. Live collection requires explicit permitted operator configuration and a one-page user action.
- Directory entries provide named centers, not district boundaries. A complete viewport pagination checkpoint does not imply full district coverage, valid polygons, treatment details, application dates, 24-hour freshness, or publication permission.
- The `UpdateMap` window is not yet verified as a treatment interval. Retain separate feature IDs and plan IDs, immutable page evidence, and source revision identity.
- A database-backed source-wide minimum request gap applies before every external Saturn call. Failure, crash, or pagination inconsistency preserves prior committed evidence.
- The local Web router requires a loopback peer and approved origin; the operator router remains independently restricted. Neither is a production authentication mechanism.

## Extension and verification

The legacy configured treatment-feed parser `beekeeperPlanPage.ts` and its manual ingestion service remain owned by the parent source-ingestion module for now; moving them requires a separate adapter contract and regression tests. Future detail/polygon adapters require independently verified upstream behavior and access/republication rights.

Unit tests cover provider query/response contracts, directory and index validation, denied origins and explicit collection. Isolated PostGIS tests cover restart-safe checkpoints, audit and migration compatibility. No test contacts the real source.
