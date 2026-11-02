# MelliAtlas

MelliAtlas is a source-backed geospatial workspace for beekeepers. The initial pilot covers Smolensk Oblast, Russia.

This repository is a multi-frontend web/API monorepo with a shared PostGIS-backed API. Its first runnable feature is inspection of a map location with current, attributed weather from Open-Meteo. Operator-triggered source ingestion and individually verified polygon overlays are implemented as an initial evidence slice; full scheduled ingestion, satellite phenology, private apiaries, and the AI agent are defined in the [umbrella specification](docs/specs/active/spec-umbrella-melliatlas.md) and [selected source-ingestion sub-specification](docs/specs/active/subspecs/source-ingestion.md).

## Repository layout

| Path                 | Responsibility                                                        |
| -------------------- | --------------------------------------------------------------------- |
| `apps/web`           | React/TypeScript, responsive map-first UI                             |
| `apps/admin`         | Separate local administrator frontend for source management           |
| `apps/api`           | Node.js/TypeScript API, source adapters, PostgreSQL/PostGIS ownership |
| `packages/contracts` | Public request/response schemas and shared types                      |
| `docs`               | Architecture, installation, usage, feature catalog and specifications |
| `tests/e2e`          | Browser-level acceptance tests                                        |

## Quick start (macOS/Linux/WSL)

Prerequisites: Node.js 22 (or newer), **pnpm 11.25.0**, and a running Docker engine with Compose. See [Installation](docs/INSTALLATION.md) for macOS, WSL 2 and Windows PowerShell, first-time prerequisites, database setup and troubleshooting.

```bash
pnpm install --frozen-lockfile
# Only for the first setup; do not overwrite existing private settings.
cp -n apps/api/.env.example apps/api/.env
docker compose up -d db
pnpm db:migrate
pnpm dev
```

Open the beekeeper map at `http://127.0.0.1:5173` and the separate local administrator interface at `http://127.0.0.1:5174`. The API listens on `http://127.0.0.1:3001`. Beekeepers see verified stored polygons only; the admin preview can show pending geometry. Source configuration does not trigger collection. The current collector fetches one bounded batch per explicit action; a full regional scheduled refresh is **not** implemented. The administrator API is local-only and must not be published without server-side authentication. See [Usage](docs/USAGE.md).

On later starts, normally use `docker compose up -d db` followed by `pnpm dev`. Re-run `pnpm db:migrate` when a new SQL migration is introduced. Internet access is required for map tiles and live weather; failures do not trigger synthetic fallback observations.

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

Live reference endpoint diagnostic (one POST, no stored records): `node scripts/check-saturn-api.mjs`. The probe requires internet access and reports upstream HTTP/JSON status and geometry candidates; the repository does not claim that the external service is currently reachable.
