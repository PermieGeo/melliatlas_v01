# MelliAtlas

MelliAtlas is a source-backed geospatial workspace for beekeepers. The initial pilot covers Smolensk Oblast, Russia.

This repository is an independently deployable web/API monorepo. Its first runnable feature is inspection of a map location with current, attributed weather from Open-Meteo. Source ingestion, verified treatment notices, satellite phenology, private apiaries, and the AI agent are defined in the [umbrella specification](docs/specs/active/spec-umbrella-melliatlas.md) and [selected source-ingestion sub-specification](docs/specs/active/subspecs/source-ingestion.md).

## Repository layout

| Path                 | Responsibility                                                        |
| -------------------- | --------------------------------------------------------------------- |
| `apps/web`           | React/TypeScript, responsive map-first UI                             |
| `apps/api`           | Node.js/TypeScript API, source adapters, PostgreSQL/PostGIS ownership |
| `packages/contracts` | Public request/response schemas and shared types                      |
| `docs`               | Architecture, installation, usage, feature catalog and specifications |
| `tests/e2e`          | Browser-level acceptance tests                                        |

## Quick start (macOS/Linux/WSL)

Prerequisites: Node.js 22+, pnpm 11, Docker with Compose.

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d db
pnpm install
pnpm db:migrate
pnpm dev
```

Open `http://localhost:5173`; API listens on `http://localhost:3001` by default. Click a point on the map to request an attributed weather report. Internet connectivity is required for map tiles and Open-Meteo. Errors are reported rather than replaced by sample observations.

## Verification

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
python3 tools/specs/validate_state.py
python3 tools/feature_context.py WEATHER.POINT_FORECAST
```

## Documentation

| For                                     | Read                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| Installation on macOS, Linux or Windows | [INSTALLATION](docs/INSTALLATION.md)                                           |
| Using the UI and current HTTP API       | [USAGE](docs/USAGE.md)                                                         |
| Developer workflow                      | [INSTRUCTIONS](docs/INSTRUCTIONS.md)                                           |
| Current versus planned capabilities     | [FEATURES](docs/FEATURES.md)                                                   |
| Environment and operations              | [CONFIGURATION](docs/CONFIGURATION.md), [DIAGNOSTIC](docs/DIAGNOSTIC.md)       |
| Code structure                          | [ARCHITECTURE](docs/ARCHITECTURE.md), [IMPLEMENTATION](docs/IMPLEMENTATION.md) |
| Verification                            | [TESTS](docs/TESTS.md), [QUALITY](docs/QUALITY.md)                             |
| Future milestones and SDD               | [ROADMAP](docs/ROADMAP.md), [specification index](docs/specs/README.md)        |
| LLM and contributor boundaries          | [AGENTS.md](AGENTS.md) and nested instructions                                 |

External source terms and access rights require verification before production ingestion.
