# MelliAtlas

MelliAtlas is a source-backed geospatial workspace for beekeepers. The initial pilot covers Smolensk Oblast, Russia.

This repository is an independently deployable web/API monorepo. Its first runnable feature is inspection of a map location with current, attributed weather from Open-Meteo. Operator-triggered source ingestion and individually verified polygon overlays are implemented as an initial evidence slice; full scheduled ingestion, satellite phenology, private apiaries, and the AI agent are defined in the [umbrella specification](docs/specs/active/spec-umbrella-melliatlas.md) and [selected source-ingestion sub-specification](docs/specs/active/subspecs/source-ingestion.md).

## Repository layout

| Path                 | Responsibility                                                        |
| -------------------- | --------------------------------------------------------------------- |
| `apps/web`           | React/TypeScript, responsive map-first UI                             |
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

Open the Local URL printed by Vite (normally `http://localhost:5173`); the API listens at `http://127.0.0.1:3001` by default. Click a point on the map to request attributed Open-Meteo weather. The locally bound administrator interface opens source settings without a token; saving a configuration triggers one bounded page fetch. Source-derived valid polygons appear as **unverified preview** on the administrator map immediately after import. Public `GET /api/v1/notices` still includes verified polygons only. Do not expose the unauthenticated administrator service on a public interface. See [Usage](docs/USAGE.md) for the provider configuration workflow and API examples.

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
