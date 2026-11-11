# Using MelliAtlas Locally

For first-time platform setup, versions and database configuration, see [Installation](INSTALLATION.md). Run these commands from the repository root.

## Start and stop

```bash
docker compose up -d db
pnpm db:migrate # First start or after new migrations
pnpm dev
```

| Interface            | Address                              | Purpose                                      |
| -------------------- | ------------------------------------ | -------------------------------------------- |
| Beekeeper map        | `http://127.0.0.1:5173`              | Weather, map and stored treatment evidence   |
| Local administration | `http://127.0.0.1:5174`              | Source setup, explicit collection and review |
| API readiness        | `http://127.0.0.1:3001/health/ready` | Reports backend/database availability        |

Stop app servers with `Ctrl+C`; `docker compose stop db` stops the database without deleting its volume. Do not use `docker compose down -v` for routine shutdown.

## Beekeeper map

Select a location and viewing radius to inspect attributed Open-Meteo conditions. Toggle the treatment layer and select a polygon for source, dates, preparations and review status. The radius is a visual aid, **not** a safety calculation. `pending` source polygons are explicitly unverified; missing polygons are not evidence that no treatments occurred. Map movement reads local evidence only and never downloads a provider page. The **Help** view provides RU/EN guidance.

The experimental **Load district data** panel may show blue Saturn **center points** from a local index. These are neither treatment polygons nor proof of application. See the opt-in workflow below.

## Local operator workflow

1. In **Configuration**, inspect or edit the treatment source and save its versioned settings. Saving does **not** retrieve records.
2. In **Data collection**, explicitly request the next bounded treatment page and inspect run status. A page is not complete district coverage.
3. In **Map and analysis**, inspect sourced polygon previews. Review **Sources** and **Record review** before independently verifying or rejecting candidates; a source-reported pesticide hazard class is not a scientific safety verdict.
4. Use **Help** for localized field explanations and the distinction between cache, index, source document and reviewed notice.

You can initialize the candidate treatment-feed preset after migrations:

```bash
pnpm provider:seed:saturn
```

Re-running preserves customized provider settings. The preset does not call Saturn. Operator routes are restricted to **localhost**, not authenticated for public deployment. See [Configuration](CONFIGURATION.md).

## Optional Saturn viewport pilot

Only after reviewing external source access conditions, start the backend with `SATURN_VIEWPORT_LIVE_ENABLED=true` in its environment. In the local Web map, select a Saturn district, zoom to a viewport no larger than **1° × 1°**, choose an `UpdateMap` period of at most **124 days** and explicitly click **Fetch up to 10 more records**. The district directory can also be refreshed by an explicit click. A request shares the backend's **20-second** minimum source-wide interval; wait before another action. Cache checks and map panning do not contact Saturn.

Admin → **Data collection** exposes saved viewport queries, per-page history and a sanitized request log. Completion of an index request establishes neither full district coverage nor treatment dates or pesticide safety. Disable the flag to stop future live pilot requests without removing stored index evidence.

## Explore a fictional data set

```bash
pnpm demo:prepare
pnpm demo:dev
```

The demo uses an isolated local `melliatlas_demo` database with synthetic fields and even simulated review states. It does not fetch Saturn or modify the normal database. Stop the demo server before returning to `pnpm dev`. Never use the ordinary provider import against the demo connection. The separate full-stack browser demo check is `pnpm e2e:demo` (see [Tests](TESTS.md)).

## Project maintenance commands

| Command                                    | Use                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `sh ./run-format.sh` or `pnpm format`      | Apply Prettier formatting; **changes source files**                      |
| `pnpm format:check`                        | Validate formatting without editing                                      |
| `pnpm typecheck`                           | Check strict TypeScript across packages                                  |
| `pnpm test`                                | Run API/Web/Admin unit and component tests                               |
| `pnpm build`                               | Build API and both frontends                                             |
| `python3 -B tools/specs/validate_state.py` | Verify SDD checkpoint, links and feature cross-references                |
| `sh ./run-tests.sh`                        | Run the canonical **read-only** checks, including PostGIS and Playwright |

Formatting belongs **before** the read-only checks. The canonical runner requires the local database, Node.js/pnpm, Python 3 and Playwright Chromium; a missing prerequisite is a failure, not a skipped test. Exact setup and result interpretation are in [Tests](TESTS.md). Do not weaken valid assertions to obtain a green result.

For troubleshooting, see [Diagnostics](DIAGNOSTIC.md). Source permissions, observed Saturn contracts and unresolved evidence are tracked separately in the [source register](source-register.md).
