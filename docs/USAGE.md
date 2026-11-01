# Using MelliAtlas

The current release provides a locally bound administrator UI for provider configuration, a source-backed map and point weather. No token is required for local source editing. Saving the provider configuration triggers exactly one bounded page fetch; source-derived valid polygons are immediately visible on the administrator map as **unverified**. Verified publication remains a separate data-quality decision. The API is not designed for unauthenticated internet exposure.

## 1. Open and explore the map

1. Follow [Installation](INSTALLATION.md), start `pnpm dev`, then open the Local URL printed by Vite (normally `http://localhost:5173`).
2. Select a Smolensk Oblast region shortcut or navigate directly on the Leaflet map.
3. Click or tap a point. The panel requests actual Open-Meteo forecast-model data from the backend and displays the provider link and relevant timestamps.
4. Adjust the inspection radius to draw a circle. **The radius does not trigger a treatment-plan search or a risk calculation.**
5. Open **Источники данных** (Data Sources) to inspect catalog entries and their status. A configured catalog entry does not imply successful collection or verified rights.

Weather and map tiles need internet access. A network error is shown as an error, never replaced by synthetic live observations. The layout provides compact navigation on phones.

## 2. Configure an external treatment provider (local administrator)

Open **Настройки источника**. Connection fields load automatically without a token or an extra Open button. Edit the provider name, HTTPS endpoint, method, region filter and bounded JSON parameters. **Сохранить и загрузить страницу** saves the revision and initiates a one-page import. A network/parse failure is shown separately: settings may be saved even if import fails. **Загрузить одну страницу** retries explicitly. The map preview includes only actual source-derived valid geometries, with pending features clearly marked **unverified**. No sample features are synthesized.

**Deployment:** Both API and dev UI must remain accessible only from the local machine; the API binds to `127.0.0.1`. There is no application token, login or remotely enforced administrator identity. Do not publish the administrator API on the internet. A future public client must exclude operator endpoints and pending previews.

### Initialize the reference provider from the command line

After `docker compose up -d db` and `pnpm db:migrate`, run from the repository root:

```bash
pnpm provider:seed:saturn
```

This is a one-time or repeatable database seed, **not a live download**. Its preset is `apps/api/config/providers/fgis-saturn.json`, containing the source name, type `treatment`, full HTTPS URL, API request settings, and no API key (`NULL`). The endpoint and numeric region code reproduce the reference prototype request; actual responses may differ. The reference preset does not require an API key.

A customized row is not overwritten. For deliberate replacement, use:

```bash
pnpm --dir apps/api provider:seed config/providers/fgis-saturn.json --replace
```

The `--replace` flag clears stored credentials, the ingestion cursor, and historical access metadata; the configured source remains available for explicit manual fetching. Other provider files can be supplied to `pnpm --dir apps/api provider:seed <preset.json>`; the current seed supports one `treatment-feed` record and `treatment` type. Optional third-party keys must be passed through `apiKeyEnv` in the preset and the matching server environment variable, **not** as plaintext in checked-in JSON. Keys are stored in the database and are excluded from HTTP responses and registry revision snapshots; production credential encryption and least-privilege DB access remain operational responsibilities.

### Access to the administrator UI

Start the API and web UI locally (`pnpm dev`) and visit `http://localhost:5173`. No token is required. To test the upstream endpoint without modifying PostgreSQL, run `node scripts/check-saturn-api.mjs` from the root. This performs one HTTPS POST using the committed reference preset, page size 1, prints status/record/geometry counts and fails on HTTP/JSON errors. It does not validate external reuse terms or prove a dataset contains features near a selected point.

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

Click **Сохранить и загрузить страницу**. The API uses optimistic `expectedRevision` concurrency checks (409 on conflicts). Once settings are saved, the UI requests one page and updates the map preview; imports are not scheduled. HTTP failures do not fabricate data or roll back an already saved connection. A changed endpoint clears the ingestion cursor. Invalid geometry remains a text-only candidate and cannot be drawn. Verified publication still requires a reviewer decision.

## 3. Use the current HTTP API

The API is local at `http://127.0.0.1:3001` by default; in the browser, Vite proxies `/api` to that server.

| Method/path                                           | Availability and behavior                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /health/live`                                    | Process liveness; does not check PostGIS                                            |
| `GET /health/ready`                                   | Database readiness; HTTP 503 when unavailable                                       |
| `GET /api/v1/sources`                                 | Source catalog metadata; **not collected treatment notices**                        |
| `GET /api/v1/locations/inspect?lat=54.782&lon=32.045` | Live Open-Meteo forecast data for valid WGS84 coordinates                           |
| `GET /api/v1/operator/provider`                       | Local admin only; reads configured settings                                         |
| `PUT /api/v1/operator/provider`                       | Local admin only; validates and saves settings. The UI initiates one separate fetch |

Public checks:

```bash
curl -i http://127.0.0.1:3001/health/live
curl -i http://127.0.0.1:3001/health/ready
curl -i http://127.0.0.1:3001/api/v1/sources
curl -i 'http://127.0.0.1:3001/api/v1/locations/inspect?lat=54.782&lon=32.045'
```

Local administrator read:

```bash
curl -i \
  http://127.0.0.1:3001/api/v1/operator/provider
```

The full editable JSON schema is owned by `packages/contracts/src/index.ts` (`providerConfigurationEditSchema`). To avoid accidental updates, read the current revision before any `PUT`. API errors carry a stable error code and `X-Request-ID`; invalid coordinates return `400 INVALID_COORDINATES`, and rate limiting returns HTTP 429.

## 4. Programmatic configuration and source-fetch boundary

- `buildProviderRequest(endpoint, settings)` in `apps/api/src/modules/sources/providerConfiguration.ts` is a pure request builder for `GET`/`POST`, including a nested region filter. It returns a request description and **does not send it**.
- `RestrictedSourceFetcher` permits a configured manual `treatment` source or a separately approved municipal source; in both cases it verifies the destination, DNS/IP safety, TLS and response limits.
- `parseBeekeeperPlanPage` in `apps/api/src/modules/sources/beekeeperPlanPage.ts` parses the reference response format without making network calls.

The operator-triggered ingest, PostGIS document/observation storage and public reviewed-polygon endpoint are implemented. They require a local administrator UI and separate polygon review before public publication; there is no background worker or documentary access-approval form. Source payloads and expected formats still require provider-specific verification before live use. See [Implementation](IMPLEMENTATION.md) and [source-ingestion requirements](specs/active/subspecs/source-ingestion.md).

## 5. What the information does not mean

- Forecast weather is not direct evidence of pesticide application or a statement that spraying is safe.
- Catalog lifecycle/review fields describe configuration and review state, not the existence of current observations.
- Historical/legacy registry rows may remain for audit even when a newer candidate connection is selected.
- Private apiaries, scheduled treatment ingestion and agent-generated analysis remain future capabilities. Reviewed provider polygons are supported only after explicit operator verification.

For errors, see [Diagnostics](DIAGNOSTIC.md). For installed dependencies, database setup and restarting the app, see [Installation](INSTALLATION.md).

## Structured treatment-feed ingestion (manual operator workflow)

The provider endpoint and JSON request settings are stored in `source_catalog`; the reference preset uses `content`, `beeAcreage` and `allPatList`. The backend supports one page per operator action and never invents missing shapes.

1. Apply migrations **001–009** with `pnpm db:migrate`. Optionally initialize the provider using `pnpm provider:seed:saturn` (repeat runs preserve customizations). Start `pnpm dev` and open **Настройки источника**; the form loads automatically.
2. Click **Сохранить и загрузить страницу**, or **Загрузить одну страницу** for a retry. No reviewer name, permission document, URL or justification is requested at the source-connection stage. The backend constructs a bounded request from the saved endpoint; there is no scheduled polling. A successful response stores raw JSON and pending candidates, which appear as unverified polygons in the administrator preview but not the verified public endpoint.
3. Check **Состояние импорта** for the last run, errors and counts. Use **Показать ожидающие проверки записи** to inspect source-reported coordinates and attributes. Verify/reject individual candidate polygons with a reviewer name and an evidence note. This is a **data-quality review**, not a permission-to-fetch approval.
4. Open the **Карта** tab and click **Обновить слой**. Both validated pending and verified source polygons are visible on the administrator map; pending ones are dashed and marked unverified. Public notices still exclude pending data.

The public API `GET /api/v1/notices` returns up to 200 verified polygons; `bbox=west,south,east,north` optionally limits the query. Local administrator endpoints are `GET /api/v1/operator/provider/status`, `POST /api/v1/operator/provider/sync`, `GET /api/v1/operator/notices`, and `POST /api/v1/operator/notices/:id/review`. The former permission-approval route was removed; all operator endpoints are local-admin-only and do not require tokens. Provider tokens are separate and optional; the reference preset does not define one.

**Limits:** The upstream API is not automatically contacted on application start. One page is fetched per click with a minimum interval of 60 seconds in the current process, a maximum of 100 configured items per request, and a bounded stored cursor. Actual provider responses and external rights were not verified by this PATCH. Displaying a verified polygon is not an environmental safety verdict.

### Diagnose an empty map

- **No last run:** Save the settings to trigger one page, or use the explicit retry button.
- **Run failed:** Inspect `latestRun.errorCode`, URL, POST parameters and API response compatibility.
- **Run succeeded with zero candidates:** The provider returned an empty page for the configured region/filter (or a page with no accepted records).
- **Candidates lack geometry:** Inspect the provider's actual geometry format; missing/invalid shapes remain `text_only`.
- **Candidates await review:** Valid pending polygons should already be visible in the administrator preview; verify them individually only for public publication. The public notices endpoint intentionally excludes pending observations.
