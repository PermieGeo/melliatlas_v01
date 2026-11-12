# MelliAtlas Modules

This is the navigation guide to **implemented** modules. [Architecture](ARCHITECTURE.md) defines system-wide constraints; the [active specifications](specs/README.md) govern intended behavior. Read the owning `contract.md` for a cross-module boundary, not for an inventory of private helpers.

## Applications and shared contracts

| Owner                              | Purpose                                                                                                                        | Public integration                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `apps/web`                         | Beekeeper map, point/radius weather inspection, source-attributed stored treatment polygons and read-only territory navigation | Validated `/api/v1` browser client; [API contract](../apps/web/src/api/contract.md) |
| `apps/admin`                       | Separate loopback-only source settings, explicit collection, evidence review and cache diagnostics                             | Operator routes; [API contract](../apps/admin/src/api/contract.md)                  |
| `apps/api/src/app.ts`, `server.ts` | Express routes, request security/error handling and dependency composition                                                     | Versioned HTTP boundary; no independent service per module                          |
| `packages/contracts`               | Shared Zod HTTP schemas, including weather, map, provider and help payloads                                                    | [Wire contract](../packages/contracts/contract.md)                                  |

Frontend code never imports backend internals. The operator interface and its routes are **not authenticated for internet exposure**; they are restricted to local development.

## API modules

| Owner                              | Implemented responsibility                                                                                                                                                                     | Main boundary and limitation                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/core`                     | Typed source-capability registry and sequential code-defined `AnalysisGraph` with `provider`, `algorithm`, `statistics`, `ml`, `llm` node kinds                                                | [Core contract](../apps/api/src/modules/core/contract.md); currently registers weather inspection and read-only Saturn index status; no executing LLM or migration planner |
| `modules/weather`                  | Open-Meteo point forecast with response validation and provenance                                                                                                                              | `OpenMeteoAdapter.inspect`; [contract](../apps/api/src/modules/weather/contract.md)                                                                                        |
| `modules/sources`                  | Read-only territory directory adapter, restricted source retrieval, provider settings, immutable documents, observations/review, manual bounded treatment ingestion and PostGIS map projection | [Source contract](../apps/api/src/modules/sources/contract.md); public map reads only stored evidence                                                                      |
| `modules/sources/providers/saturn` | Fixed-route Saturn district directory and viewport-index pilot, cache, audit, source-specific validation and offline capture inspection                                                        | [Saturn contract](../apps/api/src/modules/sources/providers/saturn/contract.md); disabled live collection by default, centers are not polygons                             |
| `db`                               | PostgreSQL pool, read repositories and checksummed additive SQL migrations (`apps/api/migrations/`)                                                                                            | [DB contract](../apps/api/src/db/contract.md); PostGIS is the geometry store                                                                                               |
| `lib`                              | Shared backend errors and supporting HTTP primitives                                                                                                                                           | [Library contract](../apps/api/src/lib/contract.md)                                                                                                                        |

### How the current paths connect

- **Weather:** Web → API → `core` provider registry → Open-Meteo adapter → validated attributed response. No pesticide-risk inference.
- **Treatment evidence:** Local operator → configured restricted fetch → `TreatmentIngestionService` → immutable documents and reviewable PostGIS observations → read-only public map projection. This pipeline does **not** run through the core analysis graph yet.
- **Saturn viewport index:** Explicit local Admin action → Saturn adapter → common source-wide throttle/audit → stored district directory or paginated center-point index. Cached reads make no external request; neither an index nor a completed viewport establishes full district coverage.
- **Future agent workflow:** Orchestrator gathers validated provider evidence, invokes bounded deterministic/statistical/LLM executors and proposes cited migration location/date alternatives. This is architectural direction, **not** a delivered backend behavior.

`apps/api/src/modules/sources/` also contains legacy region-wide scan and scheduler code, but `server.ts` does not start it. A valid source polygon may be shown as explicitly `pending`; verified, rejected and unknown evidence have different visibility rules. No current integration establishes application execution, field safety or blanket rights to collect and republish provider data.
