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

The region/district selectors use saved navigation catalogs. Selecting a district recenters the map; it does not filter by administrative boundary, request upstream records, or imply complete district coverage. Empty catalogs require operator setup.

## Local operator workflow

1. In **Configuration**, inspect or edit the treatment source and save its versioned settings. Saving does **not** retrieve records.
2. In **Data collection**, explicitly request the next bounded treatment page and inspect run status. A page is not complete district coverage.
3. In **Map and analysis**, inspect sourced polygon previews. Review **Sources** and **Record review** before independently verifying or rejecting candidates; a source-reported pesticide hazard class is not a scientific safety verdict.
4. Use **Help** for localized field explanations and the distinction between cache, index, source document and reviewed notice.

For **full polygon-bearing Saturn records**, use the configured `/planapplybees` treatment-feed through this operator-controlled one-page action. To select its provider district and date range, see [Direct Saturn treatment pages](CONFIGURATION.md#direct-saturn-treatment-pages). The operator-only `/query` index remains a separate center-only diagnostic; the HAR inspector below is optional research, **not** a prerequisite for direct treatment ingestion. Neither a saved page nor a displayed polygon establishes a completed treatment or full district coverage.

You can initialize the candidate treatment-feed preset after migrations:

```bash
pnpm provider:seed:saturn
```

Re-running preserves customized provider settings. The preset does not call Saturn. Operator routes are restricted to **localhost**, not authenticated for public deployment. See [Configuration](CONFIGURATION.md).

## Optional Saturn viewport pilot

`pnpm db:migrate` now registers the pilot **Smolensk Oblast** navigation region in the local `territory_regions` catalog, with the internal ID `ru-smolensk`. Migration 017 also adds the observed Saturn region code `55` to the **separate operator allowlist**; neither action makes an external request or enables provider access. Run the migration after upgrading an existing database. Check the public region API with `curl http://127.0.0.1:3001/api/v1/territories/regions`.

For other provider codes, the operator-only seed command remains available:

```bash
pnpm --dir apps/api saturn:regions:seed config/saturn-demo-regions.json
```

This command registers provider-specific codes for Admin, **not** new public geographic regions. Adding a public region requires a verified local territory entry and provider-code mapping in a subsequent migration. A new region or empty saved district cache does not imply district coverage; use **Refresh district directory** explicitly in Admin only when source access is permitted.

Initial map centers are presentation-only presets in `apps/web/config/map-defaults.json` and `apps/admin/config/map-defaults.json`; they do not restrict the registered provider regions or allowable WGS84 viewport selections.

Only after reviewing source access conditions, enable `SATURN_VIEWPORT_LIVE_ENABLED=true` for the local operator API. In **Admin → Data collection**, select a registered provider region, explicitly refresh its district directory and, if useful, request one bounded `/query` index page with a viewport and UpdateMap window of at most 124 days. This is not treatment geometry. For full treatment polygons, use the separate operator one-page `/planapplybees` ingestion described above. The shared provider throttle remains in effect. Public Web only reads stored PostGIS polygons and navigates cached territory centers; map navigation does not start provider traffic.

### Optional HAR diagnostics for the map index (research only)

With appropriate source access permission, inspect one public map field through a short, normal browser session. In Chrome DevTools **Network**, clear earlier requests, keep the relevant request bodies and export **HAR with content** after the matching viewport `/query`, polygon `/geojson-polygons` and clicked `/acr/{fieldId}` responses have completed. For the current Yartsevo research candidate, the previously observed field ID is `2038836`. Keep the original HAR **local and private**: it can contain cookies, authorization headers, unrelated requests, farm names and precise field data. Do not commit it, upload it to a third party or place it in public test fixtures.

```bash
pnpm --dir apps/api evidence:saturn -- --har-preview /private/path/capture.har --acr-id 2038836
pnpm --dir apps/api evidence:saturn -- --har /private/path/capture.har --acr-id 2038836
```

Use `--har-preview` first if the exported session may contain multiple requests or missing response bodies. It reports only counts of exact matched `/query`, `/geojson-polygons` and requested `/acr` requests and readable bodies, plus one of `CANDIDATE_TRIO`, `AMBIGUOUS`, `INCOMPLETE` or `UNREADABLE`. A readable body only passes a shallow bounded HAR check; it may still contain invalid JSON, incompatible filters or unrelated geometry. `CANDIDATE_TRIO` is **not** verified evidence. Neither mode prints raw URL paths, the requested ACR ID, request headers or response contents; both read the file entirely offline.

The command reads the HAR offline (maximum 32 MiB and 2,000 entries), requires **exactly one** successful response for each of the three selected endpoints, and reports only bounded, sanitized identity candidates, captured-request time span, viewport overlap and a digest of the HAR file. If the session contains multiple matching requests, it fails rather than guessing which bodies belong together; capture a shorter clean session. Missing browser-exported response content also fails closed. This mode does not extract raw files to disk or contact Saturn, and cannot authenticate HAR timestamps, geometry ownership, source permissions, application dates or district coverage. The existing direct-body CLI and optional manifest remain available for controlled captures whose request/response bodies were saved separately.

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
