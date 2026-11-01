# Current Implementation

This page describes **running code**. Planned behavior is owned by [specifications](specs/README.md).

## Application composition

- `apps/api/src/server.ts` validates environment configuration, opens a PostgreSQL pool, constructs `SourceRepository`, `ProviderConfigurationRepository` and `OpenMeteoAdapter`, and injects them into `createApp`.
- `apps/api/src/app.ts` installs request IDs, Helmet, JSON body limits, global rate limiting, readiness/liveness, two public `/api/v1` routes and authenticated Provider settings GET/PUT. It translates known errors into structured responses.
- `apps/api/src/modules/weather/openMeteo.ts` calls the fixed Open-Meteo forecast endpoint with a timeout and validates current conditions.
- `apps/api/src/modules/sources/contracts.ts` declares validated municipal/treatment-source access policy, fetch limits, document/run and text-only notice-candidate schemas. `destinationPolicy.ts` performs strict offline approval, HTTPS host and path-prefix preflight checks. `ApprovedSourceRegistry.getApproved()` loads eligible approved municipal or treatment-source registrations; `MunicipalSourceRegistry` remains a compatibility alias. `httpFetcher.ts` implements restricted DNS/TLS/redirect handling but is not connected to a production route or ingestion worker.
- `apps/api/src/db/` owns the pool, migration runner and public source-catalog SQL. Migrations `001`–`002` establish the PostGIS/evidence schema and reviewed-access history. Immutable historical migration `003_saturn_api_configuration.sql` creates an inert legacy candidate; `004_provider_connection.sql` creates the provider-neutral `treatment-feed`; `005_treatment_source_approval.sql` allows explicit complete treatment-source review without approving existing candidates. `providerConfiguration.ts` owns versioned reads/edits, access revocation on edit, and the pure `buildProviderRequest` function. No worker populates ingestion runs, documents or observations yet.
- `packages/contracts/src/index.ts` holds Zod schemas for coordinates, weather/provenance, catalog entries, operator Provider settings and error responses.
- `apps/web/src/App.tsx` composes navigation, source catalog, map selection, weather cards and the token-gated Provider configuration editor. `src/api/client.ts` decodes HTTP and validates shared schemas. `src/components/MapCanvas.tsx` owns Leaflet interaction.

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

The backend remains a single Node.js deployment. Geospatial notice APIs, full identity management, worker ingestion and AI-agent orchestration are future modules, not current entry points. The token-gated operator settings route is a narrow configuration entry point, not general user authentication. The architecture is described in [ARCHITECTURE](ARCHITECTURE.md).

## Restricted provider retrieval (SRC-01 / S2)

`apps/api/src/modules/sources/httpFetcher.ts` implements a bounded, injectable HTTPS transport for explicitly approved source registrations. It pins a publicly routable DNS answer to direct TLS, validates certificates and the socket peer, rejects unsafe redirects, and caps response size, MIME, time and retries. It is not connected to an API endpoint, scheduler or public map. SQL migration `005_treatment_source_approval.sql` permits separately reviewed `treatment` registrations without approving any existing candidate. Any provider configuration edit revokes previous approval. A verified access decision and independently confirmed API contract are still prerequisites for actual collection.
