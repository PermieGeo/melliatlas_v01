# Current Implementation

This page describes **running code**. Planned behavior is owned by [specifications](specs/README.md).

## Application composition

- `apps/api/src/server.ts` validates environment configuration, opens a PostgreSQL pool, constructs `SourceRepository`, `ProviderConfigurationRepository` and `OpenMeteoAdapter`, and injects them into `createApp`.
- `apps/api/src/app.ts` installs request IDs, Helmet, JSON body limits, global rate limiting, readiness/liveness, two public `/api/v1` routes and authenticated Provider settings GET/PUT. It translates known errors into structured responses.
- `apps/api/src/modules/weather/openMeteo.ts` calls the fixed Open-Meteo forecast endpoint with a timeout and validates current conditions.
- `apps/api/src/modules/sources/contracts.ts` declares internal municipal source, fetch policy, document, run and text-only notice-candidate schemas. `destinationPolicy.ts` performs offline operator-approval, exact-host and path-prefix preflight checks. The read-only `MunicipalSourceRegistry` maps an approved database registration to validated internal policy. No production route or fetch transport uses it yet; DNS/redirect protections and ingestion remain unimplemented.
- `apps/api/src/db/` owns the pool, migration runner and public source-catalog SQL. `apps/api/migrations/001_source_core.sql` initializes PostGIS source, run, document and spatial tables; `002_source_access_registry.sql` adds reviewed-access metadata and append-only configuration history. Existing sources retain pending permission. Migration `003_saturn_api_configuration.sql` adds pending Provider request configuration. `providerConfiguration.ts` owns versioned reads/edits and an offline request builder. No worker populates runs, documents or observations yet.
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

`modules/sources/httpFetcher.ts` implements a bounded, injectable HTTPS transport for explicit approved source registrations. It pins a publicly routable DNS answer to direct TLS, validates certificates and the socket peer, rejects unsafe redirects, and caps response size, MIME, time and retries. It is not connected to an API endpoint, scheduler or public map. SQL migration `005_treatment_source_approval.sql` permits separately reviewed `treatment` registrations without approving any existing candidate. Any provider configuration edit revokes previous approval. A verified access decision and independently confirmed API contract are still prerequisites for actual collection.
