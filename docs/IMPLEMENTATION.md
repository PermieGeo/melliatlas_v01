# Current Implementation

This page describes **running code**. Planned behavior is owned by [specifications](specs/README.md).

## Application composition

- `apps/api/src/server.ts` validates environment configuration, opens a PostgreSQL pool, constructs `SourceRepository` and `OpenMeteoAdapter`, and injects them into `createApp`.
- `apps/api/src/app.ts` installs request IDs, Helmet, JSON body limits, global rate limiting, readiness/liveness and two public `/api/v1` routes. It translates known errors into structured responses.
- `apps/api/src/modules/weather/openMeteo.ts` calls the fixed Open-Meteo forecast endpoint with a timeout and validates current conditions.
- `apps/api/src/modules/sources/contracts.ts` declares internal municipal source, fetch policy, document, run and text-only notice-candidate schemas. `destinationPolicy.ts` performs offline operator-approval, exact-host and path-prefix preflight checks. The read-only `MunicipalSourceRegistry` maps an approved database registration to validated internal policy. No production route or fetch transport uses it yet; DNS/redirect protections and ingestion remain unimplemented.
- `apps/api/src/db/` owns the pool, migration runner and public source-catalog SQL. `apps/api/migrations/001_source_core.sql` initializes PostGIS source, run, document and spatial tables; `002_source_access_registry.sql` adds reviewed-access metadata and append-only configuration history. Existing sources retain pending permission. No worker populates runs, documents or observations yet.
- `packages/contracts/src/index.ts` holds Zod schemas for coordinates, weather/provenance, catalog entries and error responses.
- `apps/web/src/App.tsx` composes navigation, source catalog, map selection and weather cards. `src/api/client.ts` decodes HTTP and validates shared schemas. `src/components/MapCanvas.tsx` owns Leaflet interaction.

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

The backend remains a single Node.js deployment. Source workers, geospatial notice APIs, authentication and AI-agent orchestration are future modules, not current entry points. The architecture is described in [ARCHITECTURE](ARCHITECTURE.md).
