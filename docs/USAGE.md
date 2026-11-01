# Using MelliAtlas

The current release provides a real map/location weather view, a source catalog, and a configurable operator-only treatment-provider connection. **It supports operator-triggered fetching and review-gated map polygons after independent source-access approval.** Saving a provider URL alone never fetches records or populates the map.

## 1. Open and explore the map

1. Follow [Installation](INSTALLATION.md), start `pnpm dev`, then open the Local URL printed by Vite (normally `http://localhost:5173`).
2. Select a Smolensk Oblast region shortcut or navigate directly on the Leaflet map.
3. Click or tap a point. The panel requests actual Open-Meteo forecast-model data from the backend and displays the provider link and relevant timestamps.
4. Adjust the inspection radius to draw a circle. **The radius does not trigger a treatment-plan search or a risk calculation.**
5. Open **Источники данных** (Data Sources) to inspect catalog entries and their status. A configured catalog entry does not imply successful collection or verified rights.

Weather and map tiles need internet access. A network error is shown as an error, never replaced by synthetic live observations. The layout provides compact navigation on phones.

## 2. Configure an external treatment provider (operator only)

The **Настройки источника** tab configures one candidate external treatment feed. The displayed provider name, endpoint and request shape are editable; the UI does not hard-code a provider brand. These settings do not initiate a network request or enable ingestion.

The tab shows public source-catalog metadata (name, type, URL, lifecycle and last successful ingestion) without authentication. This is not an API connectivity test: metadata can exist even while access is pending and ingestion has never run. The detailed request configuration and editing form remain behind the operator bearer token; the provider API key is never shown. The map remains empty until permitted ingestion succeeds and individual polygons are verified by an operator. The operator diagnostics panel displays the access decision, the latest run, candidate counts, and missing geometries.

### Initialize the reference provider from the command line

After `docker compose up -d db` and `pnpm db:migrate`, run from the repository root:

```bash
pnpm provider:seed:saturn
```

This is a one-time or repeatable database seed, **not a live download**. Its preset is `apps/api/config/providers/fgis-saturn.json`, containing the source name, type `treatment`, full HTTPS URL, API request settings, and no API key (`NULL`). The endpoint and numeric region code reproduce the prototype's request and require separate verification before use. There is no external token for this preset. `SOURCE_OPERATOR_TOKEN` is separately used to protect editing through the web UI.

A customized row is not overwritten. For deliberate replacement, use:

```bash
pnpm --dir apps/api provider:seed config/providers/fgis-saturn.json --replace
```

The `--replace` flag resets prior access approval, removes any saved API key and returns the source to review. Other provider files can be supplied to `pnpm --dir apps/api provider:seed <preset.json>`; the current seed supports one `treatment-feed` record and `treatment` type. Optional third-party keys must be passed through `apiKeyEnv` in the preset and the matching server environment variable, **not** as plaintext in checked-in JSON. Keys are stored in the database and are excluded from HTTP responses and registry revision snapshots; production credential encryption and least-privilege DB access remain operational responsibilities.

### Prepare operator access

The operator bearer token protects the **MelliAtlas settings API**, not the external provider API. It is optional for ordinary map and weather use.

1. In `apps/api/.env`, set `SOURCE_OPERATOR_TOKEN` to a random value of at least 32 characters. To generate one on macOS/Linux, run `openssl rand -hex 32` and paste the resulting value into the environment file. Do not commit or share it.
2. Restart the API (`Ctrl+C` followed by `pnpm dev`) to load the new environment variable.
3. Open **Настройки источника** in the app, enter the same token in **Токен оператора**, and click **Открыть настройки**.
4. If the token is absent, the API returns `503 OPERATOR_UNAVAILABLE`; a wrong token returns `401 UNAUTHORIZED`.

### Edit connection settings

- **Название источника:** descriptive operator-provided label.
- **HTTPS API endpoint:** complete `https://` URL of the intended API. Plain HTTP, URL credentials, fragments, query strings and IP-literal hosts are rejected; use the appropriate provider hostname and path.
- **Метод:** `POST` for a JSON request body or `GET` for URL query parameters.
- **Параметр региона / Код региона:** a parameter name and a numeric provider-specific code. **Do not assume** that a regional code in a reference prototype is correct for a different provider.
- **Объект фильтра региона:** optional JSON object key containing the regional parameter (for example, `searchFilter`). Leave empty for a top-level parameter.
- **Дополнительные параметры запроса:** a JSON object, not a JavaScript expression. It may contain pagination, sort options and other bounded fields. It must not overwrite the region key/container.

For example, these generic settings:

```json
{
  "method": "POST",
  "regionParameter": "regionId",
  "regionContainer": "searchFilter",
  "regionCode": 10,
  "parameters": { "pageNumber": 0, "pageSize": 20 }
}
```

produce this JSON request body when combined with a configured endpoint:

```json
{
  "pageNumber": 0,
  "pageSize": 20,
  "searchFilter": { "regionId": 10 }
}
```

This is **synthetic configuration guidance**, not an assertion that an external API supports these field names or has records for the chosen region.

Click **Сохранить конфигурацию** to persist the settings. The API uses optimistic `expectedRevision` matching: if another tab/operator saved first, the API returns `409 PROVIDER_REVISION_CONFLICT`. Reload, review the latest settings, and retry. The token remains in the component's memory and is sent in an Authorization header; it is not returned by the API.

**After any edit, prior source approval is revoked.** The source returns to `pending` / `under_review` and automatic collection remains disabled. A reviewer must independently confirm source access, API contract, allowed hosts and request policy before a future ingestion adapter can use it. No external provider token is currently required by the generic settings editor; this does **not** establish whether a particular provider requires authentication.

## 3. Use the current HTTP API

The API is local at `http://127.0.0.1:3001` by default; in the browser, Vite proxies `/api` to that server.

| Method/path                                           | Availability and behavior                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /health/live`                                    | Process liveness; does not check PostGIS                                                                |
| `GET /health/ready`                                   | Database readiness; HTTP 503 when unavailable                                                           |
| `GET /api/v1/sources`                                 | Source catalog metadata; **not collected treatment notices**                                            |
| `GET /api/v1/locations/inspect?lat=54.782&lon=32.045` | Live Open-Meteo forecast data for valid WGS84 coordinates                                               |
| `GET /api/v1/operator/provider`                       | Requires operator bearer token; reads candidate settings                                                |
| `PUT /api/v1/operator/provider`                       | Requires operator bearer token, validated JSON and `expectedRevision`; stores settings without fetching |

Public checks:

```bash
curl -i http://127.0.0.1:3001/health/live
curl -i http://127.0.0.1:3001/health/ready
curl -i http://127.0.0.1:3001/api/v1/sources
curl -i 'http://127.0.0.1:3001/api/v1/locations/inspect?lat=54.782&lon=32.045'
```

Operator read (replace the placeholder locally; do not copy real tokens into logs, tickets or shell history):

```bash
curl -i \
  -H 'Authorization: Bearer <operator-token>' \
  http://127.0.0.1:3001/api/v1/operator/provider
```

The full editable JSON schema is owned by `packages/contracts/src/index.ts` (`providerConfigurationEditSchema`). To avoid accidental updates, read the current revision before any `PUT`. API errors carry a stable error code and `X-Request-ID`; invalid coordinates return `400 INVALID_COORDINATES`, and rate limiting returns HTTP 429.

## 4. Programmatic configuration and source-fetch boundary

- `buildProviderRequest(endpoint, settings)` in `apps/api/src/modules/sources/providerConfiguration.ts` is a pure request builder for `GET`/`POST`, including a nested region filter. It returns a request description and **does not send it**.
- `RestrictedSourceFetcher` in `apps/api/src/modules/sources/httpFetcher.ts` can fetch only when supplied an independently approved source definition and permitted destination. It is intended for injected/synthetic tests and future adapter wiring.
- `parseBeekeeperPlanPage` in `apps/api/src/modules/sources/beekeeperPlanPage.ts` parses the reference response format without making network calls.

The operator-triggered ingest, PostGIS document/observation storage and public reviewed-polygon endpoint are implemented. They require manual authorization and review; there is no background worker or automatic source approval. Source payloads and expected formats still require provider-specific verification before live use. See [Implementation](IMPLEMENTATION.md) and [source-ingestion requirements](specs/active/subspecs/source-ingestion.md).

## 5. What the information does not mean

- Forecast weather is not direct evidence of pesticide application or a statement that spraying is safe.
- Catalog lifecycle/review fields describe configuration and review state, not the existence of current observations.
- Historical/legacy registry rows may remain for audit even when a newer candidate connection is selected.
- Private apiaries, scheduled treatment ingestion and agent-generated analysis remain future capabilities. Reviewed provider polygons are supported only after explicit operator verification.

For errors, see [Diagnostics](DIAGNOSTIC.md). For installed dependencies, database setup and restarting the app, see [Installation](INSTALLATION.md).

## Structured treatment-feed ingestion (operator reviewed)

The source name and endpoint come from the database, not from the map implementation. The reference seed configures a historical portal request shape (`content`, `beeAcreage`, `allPatList`); other providers must use a compatible JSON response adapter. An arbitrary configured endpoint is **not** automatically approved or called.

1. Run all database migrations, including `007_treatment_observation_dedupe.sql`. Configure the source with the existing preset command or through the operator editor. Set `SOURCE_OPERATOR_TOKEN` in `apps/api/.env`, restart the API, then open the **Source settings** tab and authenticate.
2. Before any access approval, independently obtain and inspect documentary evidence permitting the specific automated API retrieval and reuse. Public browsing without login is not sufficient evidence. Enter the reviewer, the HTTPS permission evidence URL, and a detailed permission basis; explicitly approve. This step grants a local access decision, not an assertion by MelliAtlas that the provider authorized scraping.
3. Select **Fetch one page**. Requests are manual, bounded by the configured policy (60 seconds between attempts), and use the request parameters saved in the database. A successful fetch stores immutable raw JSON and pending candidates; it **does not** add polygons to the public map.
4. Check the **Collection status** panel. If the run failed, inspect its stable error code; if `received=0`, no candidates were returned; if `pendingWithGeometry=0`, there is no publishable polygon yet. Then select **Show pending observations**. Compare candidate identifiers, treatment details and geographic evidence with the original provider publication. Enter the reviewer and a substantial evidence note, then **Verify and publish** only source-supplied, topologically valid polygons. Reject mismatches. Pending, rejected and text-only records never appear as exact polygons.
5. Open the **Map** tab and select **Refresh layer**. Orange polygons represent individually reviewed, source-derived geometries. Click a shape for its source URL, fetch time and source-reported attributes; they are not pesticide-risk or safety verdicts.

The public API `GET /api/v1/notices` returns up to 200 verified polygons. An optional `bbox=west,south,east,north` limits the query. The read-only diagnostic endpoint `GET /api/v1/operator/provider/status` exposes the latest run status/error code, review counts and verified-geometry counts to the operator. The protected operator endpoints are `POST /api/v1/operator/provider/approve`, `POST /api/v1/operator/provider/sync`, `GET /api/v1/operator/notices` and `POST /api/v1/operator/notices/:id/review` (all use `Authorization: Bearer <SOURCE_OPERATOR_TOKEN>`). The review endpoint takes `decision`, `reviewer`, and `evidenceNote` as JSON. The source API itself may not have a browser-friendly GET page; use the provider's official publication UI for independent checks.

**Limitations:** No recurring worker or automatic polling. One page per manual sync, at most 100 items, advancing a stored cursor until the reported end of the feed. Dates and hazard attributes may be null if absent or not verified. No live probe of the reference endpoint or confirmation of automated reuse rights was performed when preparing this feature. A source remaining `pending` is an intentional safety gate, not a connection failure.

### Why a configured provider can still produce an empty map

Use the **Collection status** panel in the source settings tab after operator
sign-in. It distinguishes four independent states:

1. **Access pending:** no outbound request is authorized. A public website or
   empty API key is not equivalent to permission for automated reuse.
2. **No successful fetch:** the latest run is absent or reports a failure code.
   Inspect the code and check endpoint/request compatibility without repeatedly
   polling a site whose access has not been verified.
3. **Pending review:** a successful fetch saved candidates; only candidates
   with validated source polygons can be individually verified and published.
4. **Published polygons:** verified records exist. Return to the map and use
   **Refresh layer**. If the map still displays zero, inspect
   `GET /api/v1/notices`, browser network errors and the ingestion status counts.

This diagnostic does **not** call the provider, change source approval or
expose a provider key. The source may be publicly browsable without a login,
but an undocumented HTTP endpoint and automated reuse require independent
verification.
