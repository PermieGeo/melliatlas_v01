# Current Implementation

This page describes **running code**. Planned behavior is owned by [specifications](specs/README.md).

## Application composition

- `apps/api/src/server.ts` validates environment configuration, opens a PostgreSQL pool, constructs `SourceRepository`, `ProviderConfigurationRepository` and `OpenMeteoAdapter`, and injects them into `createApp`.
- `apps/api/src/app.ts` installs request IDs, Helmet, JSON body limits, global rate limiting, readiness/liveness, two public `/api/v1` routes and local administrator Provider settings GET/PUT. It translates known errors into structured responses.
- `apps/api/src/modules/weather/openMeteo.ts` calls the fixed Open-Meteo forecast endpoint with a timeout and validates current conditions.
- `apps/api/src/modules/sources/contracts.ts` declares validated municipal/treatment-source access policy, fetch limits, document/run and text-only notice-candidate schemas. `destinationPolicy.ts` performs strict offline approval, HTTPS host and path-prefix preflight checks. `ApprovedSourceRegistry.getApproved()` loads eligible approved municipal or treatment-source registrations; `MunicipalSourceRegistry` remains a compatibility alias. `httpFetcher.ts` implements restricted DNS/TLS/redirect handling and is called only by the operator-triggered ingestion service.
- `apps/api/src/db/` owns the pool, migration runner and public source-catalog SQL. Migrations `001`–`002` establish the PostGIS/evidence schema and reviewed-access history. Immutable historical migration `003_saturn_api_configuration.sql` creates an inert legacy candidate; `004_provider_connection.sql` creates the provider-neutral `treatment-feed`; `005_treatment_source_approval.sql` allows explicit complete treatment-source review without approving existing candidates. `providerConfiguration.ts` owns versioned reads/edits, access revocation on edit, and the pure `buildProviderRequest` function. The S3a service writes ingestion runs, immutable documents and pending observations; the S3b region worker reuses those tables and persists scan progress in the existing source cursor.
- `packages/contracts/src/index.ts` holds Zod schemas for coordinates, weather/provenance, catalog entries, operator Provider settings and error responses.
- `apps/web/src/App.tsx` composes the map-first beekeeper client; its API client fetches published notices and attributed forecasts only. `apps/admin/src/App.tsx` and independent components own provider editing, explicitly requested batches, evidence review and pending map previews.

## Boundaries

| Unit                               | Contract                                                           |
| ---------------------------------- | ------------------------------------------------------------------ |
| Backend weather adapter            | [weather/contract.md](../apps/api/src/modules/weather/contract.md) |
| Backend source policy groundwork   | [sources/contract.md](../apps/api/src/modules/sources/contract.md) |
| Backend persistence infrastructure | [db/contract.md](../apps/api/src/db/contract.md)                   |
| Backend errors                     | [lib/contract.md](../apps/api/src/lib/contract.md)                 |
| Browser HTTP client                | [api/contract.md](../apps/web/src/api/contract.md)                 |
| Browser map presentation           | [components/contract.md](../apps/web/src/components/contract.md)   |
| Public wire schemas                | [contracts/contract.md](../packages/contracts/contract.md)         |

The backend remains a single Node.js deployment. The source-attributed geospatial notice endpoint exists; full identity management and AI-agent orchestration remain future modules. Bounded optional nightly region scans use the existing backend and PostGIS. Local administrator settings are deliberately token-free and served only on the loopback interface; an internet-facing client must enforce a separate access boundary. The architecture is described in [ARCHITECTURE](ARCHITECTURE.md).

## Restricted provider retrieval (SRC-01 / S2)

`apps/api/src/modules/sources/httpFetcher.ts` implements a bounded, injectable HTTPS transport for explicitly approved source registrations. It pins a publicly routable DNS answer to direct TLS, validates certificates and the socket peer, rejects unsafe redirects, and caps response size, MIME, time and retries. It is wired to local administrator ingestion and the bounded server-side regional worker, never to a public map network trigger. Migration `005_treatment_source_approval.sql` remains historical; migration 008 permits configured treatment requests without documentary approval. Configuration edits invalidate old request cursors and review metadata.

## Provider bootstrap configuration

`apps/api/src/db/seedProvider.ts` is a manual CLI for seeding the one candidate `treatment-feed` record using an external JSON preset, not a running importer. `apps/api/src/modules/sources/providerSeed.ts` validates that preset, checks for a pristine migration placeholder and preserves custom operator changes by default. Migration `006_optional_provider_api_key.sql` adds nullable `source_catalog.api_key` and excludes credentials from future immutable policy snapshots. Explicit seeding resets review approvals; normal UI updates clear the previous provider API key to prevent reuse against a different endpoint. There is no automatic retrieval or key injection into outbound requests.

## SRC-01/S3a manual provider evidence pipeline

`apps/api/src/modules/sources/treatmentIngestion.ts` now connects the configured treatment source, the restricted S2 HTTPS fetcher, immutable raw JSON in `source_documents`, run records in `ingestion_runs`, and pending `source_observations`. Migration `007` prevents duplicate record candidates per exact document version and records operator review evidence. A guarded manual fetch reads one page at a time; Technically valid structured pending polygons may appear in `GET /api/v1/notices` with `reviewStatus: pending`, while operator-verified polygons remain explicitly distinguished. Rejected, text-only and pending model-extracted observations are excluded. `apps/admin/src/components/MapPreview.tsx` draws pending polygons as dashed unverified previews, while `apps/web/src/components/MapCanvas.tsx` displays only published polygons from public `/api/v1/notices`. The operator-only status endpoint reports configured state, last fetch status, pending candidates and available geometries. A malformed provider geometry is kept as text-only evidence without aborting an otherwise valid page. Bounded region scanning is available separately; no automatic source permission, unrestricted endpoint probing or risk classification is enabled.

### S3a manual operator fetch simplification (2026-11-01)

Migration 008 activates the configured `treatment-feed` for **operator-triggered** fetching. The permission-approval form, `/api/v1/operator/provider/approve` route, and mandatory documentary evidence have been removed for this treatment path. No operator token is required on the loopback-bound administrator service; the HTTPS destination is derived from the database endpoint and enforced by the restricted transport. The source policy's historical municipal review semantics and immutable migration history remain unchanged. Raw responses are persisted. Valid structured pending polygons can appear in public `/api/v1/notices` with an explicit unverified label; rejected and invalid records remain excluded. The bounded S3b regional worker is separate from manual diagnostics, and there is no synthetic spatial fallback.

## S3a.4 separate local administrator application

The administrator frontend runs on loopback port 5174 and uses the same Node.js API and PostGIS database as the beekeeper frontend (5173). Configuration `PUT` no longer triggers any source fetch; collection is a separate bounded action. UI strings are catalog-based in each app. The frontend split introduced no regional scan; S3b adds bounded scan controls and optional nightly scheduling. Authenticated remote administrator accounts and in-app event polling are not implemented.

### SRC-01/S3b bounded scan wiring

The API server no longer starts the legacy region-wide worker. District coverage metadata (migration 011) uses one key per source, configuration revision, provider district and upstream filter identity. A new operator-only read-only endpoint reports coverage; refresh is disabled until the actual district API filter contract is verified. The existing map remains a pure PostGIS bbox reader, preferring latest seen records (200-item response cap). No client request triggers third-party traffic; legacy one-page diagnostics are not equivalent to district freshness.
