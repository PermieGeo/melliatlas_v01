# Using MelliAtlas

## Beekeeper map (`http://127.0.0.1:5173`)

Start PostgreSQL, run the migrations and `pnpm dev` as described in [Installation](INSTALLATION.md). Open the beekeeper frontend and use the map directly: select a point for attributed Open-Meteo forecast information, choose a view radius, toggle the treatment layer and refresh the visible map extent. Select a treatment polygon to open a persistent details panel to the right of the map; polygons do not open popups or move the map. Open **Help** in the header for a detailed workflow, troubleshooting notes, source-quality caveats and a labelled fictional demo walkthrough. Help content is fetched from separate localized files rather than embedded in the UI. The radius currently draws a visual circle; it does not run a spatial risk assessment.

Treatment polygons come **only from** `GET /api/v1/notices`, the PostGIS-backed source-attributed layer. Technically valid structured plans may be shown with `pending` review status and an explicit unverified warning; operator-verified plans have a separate label. Rejected, unlocated and unstructured pending claims are hidden. If the map is empty, it does **not** prove treatments are absent. Map initialization, refresh and panning read only PostGIS through `GET /api/v1/notices?bbox=west,south,east,north`. Each request returns at most 200 records, so a broad viewport may contain more plans than are currently displayed. It never requests data from the external provider. The interface has RU/EN localization for its current primary messages; original provider names and source evidence are not translated.

## Local administrator (`http://127.0.0.1:5174`)

The admin interface has six independent sections. **Map and analysis** is the initial view and displays the preview map separately from diagnostic data collection; a compact summary below it counts only records returned by the preview endpoint, not actual treatment events or historical coverage. Small question-mark controls beside technical fields open contextual, localized RU/EN explanations by click or keyboard. Clicking a help control does not save settings or contact Saturn:

- **Help:** loads a detailed local operator guide about reviewing fields, provider configuration, diagnostic paging, troubleshooting and planned district caching. Example identifiers are fictional.
- **Data collection:** displays persisted status; operators may explicitly request the **next bounded source page** via `POST /api/v1/operator/provider/sync`. This manual per-page action is labelled **Development-only** in the UI; it will be replaced by selecting a district and refreshing a shared cache with a 24-hour TTL after the upstream district/date filters are verified. The legacy region-wide scan is disabled. Upstream requests use a source-wide database throttle with at least 20 seconds between reserved starts. Page progress is not district coverage.
- **Map and analysis:** shows preview polygons with dashed unreviewed boundaries, a persistent details sidebar and a bounded three-number summary below the map. It is not historical analytics or a pesticide safety assessment.
- **Sources:** reads the source catalog, including metadata and terms-review status.
- **Configuration:** reads and saves the provider endpoint, request method, region filter and JSON parameters with an optimistic revision check. Saving settings **never** fetches records.
- **Record review:** reads pending candidates; an operator can verify/reject individual candidates with a name and meaningful evidence note. Valid structured geometry can already appear as unverified; a review decision changes the public status to verified or removes rejected entries.

The backend retains its bounded one-page diagnostic fetch. Legacy whole-region scheduled collection is disabled and its history remains in the database. The operator can inspect district cache status at `/api/v1/operator/provider/district-cache`. District freshness is 24 hours after a fully completed listing, but the live district refresh action is intentionally disabled until source-specific district IDs, payload keys and access terms are verified. A manual page is never treated as a complete district listing.

### Security boundary

`apps/admin` and the Node.js API are bound to loopback for local development. Operator routes accept the local admin browser origin (port 5174) and reject the beekeeper browser origin (port 5173). **This is not authentication:** direct local requests have no administrator identity. Do not expose the admin frontend or `/api/v1/operator/*` through a public reverse proxy; add server-side authentication and authorization first. The separate frontend is not a security boundary on its own.

### Initialize the treatment source

```bash
pnpm db:migrate
pnpm provider:seed:saturn
```

The preset in `apps/api/config/providers/fgis-saturn.json` is a local configuration seed, not a live download. Repeat runs preserve operator customizations by default. Use `pnpm --dir apps/api provider:seed config/providers/fgis-saturn.json --replace` only when intentionally replacing those settings; replacement can reset credentials and prior source state. The reference provider does not require an API key.

For a bounded live probe without changing the database, run:

```bash
node scripts/check-saturn-api.mjs
```

The probe prints status and aggregate geometry counts without reproducing personal records. VPN/provider network restrictions can affect connectivity. This check does not guarantee license/republication rights or that the entire region has been loaded.

### API summary

| Method/path                                        | Responsibility                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/notices`                              | Public source-attributed valid polygon layer (verified and structured pending), optional geographic bbox |
| `GET /api/v1/locations/inspect`                    | Attributed forecast for one WGS84 point                                                                  |
| `GET /api/v1/sources`                              | Public source-catalog metadata                                                                           |
| `GET /api/v1/operator/provider`                    | Local administrator settings                                                                             |
| `PUT /api/v1/operator/provider`                    | Revision-checked provider settings, no fetch                                                             |
| `GET /api/v1/operator/provider/status`             | Ingestion status and counts                                                                              |
| `POST /api/v1/operator/provider/sync`              | Fetch one bounded provider page when a region scan is not active                                         |
| `GET /api/v1/operator/provider/region-scan`        | Read regional scan state/progress                                                                        |
| `POST /api/v1/operator/provider/region-scan/start` | Start or resume a region-wide scan                                                                       |
| `POST /api/v1/operator/provider/region-scan/pause` | Pause an active scan                                                                                     |
| `GET /api/v1/operator/notices/map-preview`         | Pending and verified admin preview                                                                       |
| `GET /api/v1/operator/notices`                     | Pending review queue                                                                                     |
| `POST /api/v1/operator/notices/:id/review`         | Evidence-backed review decision                                                                          |

All external provider requests originate on the backend and apply HTTPS destination, DNS/IP, timeout, payload and rate-limit restrictions. Source geometry must pass technical validation before public display; optional operator review remains separately auditable. Neither a pending plan nor an operator-reviewed plan establishes a scientific pesticide safety verdict. Public reuse permissions must be checked before internet deployment.

## Explore the interface with synthetic demo evidence

The demonstration is isolated from real data. Start the local Docker database,
then from the repository root run:

```bash
pnpm demo:prepare
pnpm demo:dev
```

Visit `http://127.0.0.1:5173` (beekeeper map) and
`http://127.0.0.1:5174` (administrator). The map initially contains fictional
fields around the default Smolensk map center. Select a field to inspect its
fictional dates, products and parcel labels. In Admin, review pending examples,
inspect the source catalog and compare verified/pending styles. **All seeded
records are synthetic**, including records with a simulated `verified` status.
The amber notice identifies the demo dataset. Source URLs use `.invalid` and
will not resolve. The demo does not fetch Saturn or assert that pesticide
applications took place.

For full-stack browser verification, stop the dev servers and run:

```bash
pnpm e2e:demo
```

The demo commands derive the connection from a local `DATABASE_URL` (or
`apps/api/.env`), but use `melliatlas_demo` for visual exploration and the
separate `melliatlas_demo_e2e` for repeatable browser tests. These databases
never share user-edited demo observations. A remote host or production mode is
refused, and the seed independently validates the actual database name. **Do not run the ordinary provider seed or manual import
against the demo connection.** To return to existing real/local records, stop
the demo server and run `pnpm dev` as usual. The normal database is untouched.

## Editing built-in user help

The user-facing guide is **not hardcoded in React or `i18n.ts`**. Each Vite app serves its
own versioned, UTF-8 static JSON documents:

- `apps/web/public/help/ru.json` and `apps/web/public/help/en.json` — beekeeper guide.
- `apps/admin/public/help/ru.json` and `apps/admin/public/help/en.json` — operator guide.

`HelpPage` fetches `help/<locale>.json` only after the Help view opens. The browser
uses the app's own `BASE_URL`; requests never contact Saturn or operator routes.
Files are copied to each Vite build's static assets, so changes require a new
frontend build/deployment in production, but no React source or API changes.
The UI uses `helpDocumentSchema` from `packages/contracts/src/helpContent.ts`
to validate `version`, `locale`, section IDs, paragraphs, steps and warnings.
All content is treated as plain text, never raw HTML or executable Markdown.

To edit a guide, update the appropriate JSON file and its translation. Preserve
matching section identifiers across RU and EN. The example must remain clearly
labelled as fictional; never insert private apiary coordinates or unverified
live safety claims. Keep short shell labels, loading and retry/error messages in
`apps/web/src/i18n.ts` and `apps/admin/src/i18n.ts`. If a guide cannot be fetched,
is malformed or has a mismatching locale, the Help view shows a localized error
and Retry action. It does not silently substitute another language.

Run `node --test scripts/help-content.test.mjs` for a dependency-free structure
and locale-parity check, followed by the canonical `./run-tests.sh` and browser
E2E suites. The dev servers serve JSON from their app's `public/` directory.

### Local viewport index collection from the beekeeper map (Yartsevo pilot)

After reviewing third-party automated-access terms, enable bounded collection in local development by starting the backend with `SATURN_VIEWPORT_LIVE_ENABLED=true pnpm dev`. Open `http://127.0.0.1:5173`, select Yartsevo District or a district from an explicitly refreshed persisted provider directory in **Load district data**, zoom to the requested fields, choose an `UpdateMap` period, then click **Fetch up to 10 more records**. The map immediately re-centers on district selection, but moving/zooming it never starts an upstream request. **Check cache** reads a saved checkpoint without upstream traffic. One **Fetch up to 10 more records** click retrieves at most one source page; wait at least 20 seconds before another attempt. Progress survives restarts via PostGIS migration 014. The selected viewport must be at most 1° × 1° and within the configured pilot coordinates.

This pilot stores map-index entries with field centers, not complete treatment notices, cadastral polygons, pesticide details, actual application evidence or completed district coverage. Therefore these entries do not automatically appear as treatment polygons on the beekeeper map. A local origin and loopback connection are required; do not publish this source-triggering endpoint until authenticated public access and abuse controls have been designed. In Admin (`http://127.0.0.1:5174`), **Data collection** now provides the same three-step instructions with advanced diagnostic controls.

## Inspecting the Saturn pilot cache

The beekeeper map's Yartsevo selector requests at most one page of ten field **index** records per explicit fetch. The page is a pagination batch, not a map tile or a field polygon. A debounced read-only lookup checks the exact selected filter automatically; `Check cache` repeats that local database read explicitly. Neither operation contacts Saturn. The map shows up to 100 blue center-point markers. Blue points are not spraying events or a safety signal; treatment polygons remain a separate notice layer. Exact bounding coordinates, dates (at most 124 days) and source revision identify the checkpoint, so moving the map or changing the period creates a different request. An invalid year-wide range gives a correction button; loading a whole year is not yet supported as one request.

In local Admin → Data collection, `Saved PostgreSQL map-index cache` shows the 20 most recently updated viewport queries and the last five page receipts per query, including data fetched from the beekeeper map. `Refresh history` is database-only. The history records committed page times, counts and filter identifiers, but not which browser initiated them. A complete page sequence is not complete district coverage or an archived treatment history. Live collection remains opt-in and restricted to the locally configured pilot.

### Choosing a Smolensk district and inspecting downloads

On the local Web map, click **Fetch all districts from Saturn** once (only after authorized provider access has been enabled on the backend). The district list is persisted and reused on subsequent visits. Choose a district, zoom to a viewport at most 1° × 1°, choose an `UpdateMap` window of at most 124 days and explicitly fetch the next batch (up to 10 index entries). A page is a segment of the provider listing, not a geographic tile. The Web map shows blue cached field centers across all previously saved filters for the selected district, independent of the current exact viewport/dates. A count of zero is not evidence that no applications occurred. Treatments, chemicals and polygon boundaries are **not** retrieved by this workflow.

In local Admin → Data Collection, inspect **Saved PostgreSQL map-index cache**, expand a saved district/period entry to see stored field IDs and centers, and use **Saturn request log** to see the most recent explicit attempts and sanitized errors. No bbox selection is required to inspect those records. Legacy importer and manual viewport coordinate controls are advanced diagnostics. If a query is still in progress, the exact-key page checkpoint persists for later explicit continuation; the UI does not silently issue additional requests.

### Inspecting previously captured Saturn bodies offline

When separately authorized browser Network captures are available, save the **direct response/request bodies** as local files. Do not save cookies, tokens, HAR archives or browser headers in the inputs. Required: the JSON body of one `POST /backend/beemaster/query` request; its corresponding single-page JSON response; the raw JSONP text from one `/backend/beemaster/geojson-polygons` response; and the exact callback name used in that polygon request. Optionally save direct JSON bodies of `/backend/beemaster/acr/{id}` responses, keeping the requested URL feature ID separately from the response's own `id`.

From the repository root, after installing dependencies:

```bash
pnpm --dir apps/api evidence:saturn -- \
  --query-request /path/to/query-request.json \
  --query-response /path/to/query-response.json \
  --polygons /path/to/polygons.jsonp \
  --callback capturedCallback \
  --acr 238194 /path/to/acr-238194.json
```

`--acr <requestedFeatureId> <file>` may be repeated up to 100 times or omitted. The command is **offline**: it makes no provider HTTP requests, database writes or file output. It prints a JSON report to stdout with `ID_ONLY_UNVERIFIED` status, counts, captured query filter dates, candidate common IDs, missing IDs, exact geometry digests, and mismatched ACR URL/body IDs. It does not print provider names, arbitrary response fields, polygon coordinates or input file paths on validation failure. Inputs are capped at 64 KiB (request), 1 MiB (page), 8 MiB (JSONP) and 256 KiB per ACR body; symlink inputs are refused. Redirect stdout only to an approved secure location if a saved report is needed, since identifiers and filter metadata can still be sensitive.

An ID match does **not** establish a verified cross-endpoint record join. Capture origin, time, zoom, viewport correspondence, completeness, `UpdateMap` semantics, access and redistribution rights remain separate evidence gates. A single page does not establish district coverage.
