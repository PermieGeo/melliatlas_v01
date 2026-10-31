# MelliAtlas

MelliAtlas is a source-backed geospatial workspace for beekeepers. The initial pilot covers Smolensk Oblast, Russia.

This repository is an independently deployable web/API monorepo. Its first runnable feature is inspection of a map location with current, attributed weather from Open-Meteo. Source ingestion, verified treatment notices, satellite phenology, private apiaries, and the AI agent are defined in the [MVP umbrella specification](docs/specs/active/spec-melliatlas-mvp.md) and the [selected source-ingestion sub-specification](docs/specs/active/subspecs/source-ingestion.md).

## Repository layout

| Path                 | Responsibility                                                        |
| -------------------- | --------------------------------------------------------------------- |
| `apps/web`           | React/TypeScript, responsive map-first UI                             |
| `apps/api`           | Node.js/TypeScript API, source adapters, PostgreSQL/PostGIS ownership |
| `packages/contracts` | Public request/response schemas and shared types                      |
| `docs`               | Architecture, roadmap, SDD specs and engineering decisions            |
| `tests/e2e`          | Browser-level acceptance tests                                        |

## Quick start

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
python3 tools/feature_context.py SRC-01
```

The [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [specification index](docs/specs/README.md), and root [agent instructions](AGENTS.md) define engineering boundaries and the selected SDD workflow. All external source terms and their operational access must be verified before a connector is enabled for production use.
