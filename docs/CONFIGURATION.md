# Configuration

This page is the reference for current runtime and persisted settings. See [Installation](INSTALLATION.md) for the first run and [Usage](USAGE.md) for the operator workflow.

## Backend environment

Copy `apps/api/.env.example` to `apps/api/.env` once, then edit the private file. Both the API and the migration command load environment variables through `dotenv` and validate API runtime configuration with Zod.

| Variable                     | Default / example                                                          | Behavior                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                   | `development`                                                              | `development`, `test`, or `production`                                                                                                   |
| `PORT`                       | `3001`                                                                     | Backend port, integer 1–65535                                                                                                            |
| `DATABASE_URL`               | `postgresql://melliatlas:local_development_only@127.0.0.1:5433/melliatlas` | Required PostgreSQL/PostGIS URL; port `5433` is the host-side Compose mapping                                                            |
| `REGION_SCAN_DAILY_UTC_HOUR` | retired                                                                    | Ignored by the server. Remove this legacy setting; region-wide background collection is disabled pending district contract verification. |
| `OPEN_METEO_TIMEOUT_MS`      | `8000`                                                                     | Weather timeout in milliseconds, valid range 1000–30000                                                                                  |

There is no application bearer token for local source settings. The administrator API binds to loopback (`127.0.0.1`) and checks browser origins; protect the host and do not reverse-proxy these routes to an untrusted network. The external provider may have its own authentication requirements, but the reference preset does not configure any key.

The Compose database uses optional `POSTGRES_PASSWORD`, defaulting to `local_development_only`; PostgreSQL initializes credentials only when the persistent volume is first created. If you change the Compose password later, changing `DATABASE_URL` alone does not reset the existing database user's password. The database is bound to host loopback `127.0.0.1:5433`.

## Browser and local routing

`apps/web/vite.config.ts` configures port **5173** with `strictPort: true` and proxies `/api` to `http://127.0.0.1:3001`. The Vite host is not explicitly pinned in this version; use the **Local** URL printed at startup (normally `http://localhost:5173`). The application sends relative `/api/v1` requests and does not contain operator secrets in its build-time configuration. Deployment must implement equivalent API routing and HTTPS itself.

## Persisted candidate-provider settings

Source configuration is kept server-side in PostgreSQL. The operator UI calls `GET/PUT /api/v1/operator/provider`, backed by `ProviderConfigurationRepository`, with optimistic revision checking. Only **one** editable candidate treatment feed is supported at present.

- Migration `001_source_core.sql` creates the source catalog, ingestion evidence tables and PostGIS schema.
- `002_source_access_registry.sql` adds review decisions, URL allowlists, request limits and append-only policy history.
- `003_saturn_api_configuration.sql` creates a historical candidate row; the migration filename remains for compatibility and must not be rewritten.
- `004_provider_connection.sql` creates the neutral `treatment-feed` candidate and disables the legacy row without deleting its history.
- `005_treatment_source_approval.sql` preserves historical reviewed-source policy for municipal and legacy sources.
- `006_optional_provider_api_key.sql` adds an optional credential field, excluded from future snapshots.
- `007_treatment_observation_dedupe.sql` adds observation deduplication and review-history storage.
- `008_manual_treatment_fetch.sql` marks aligned configured `treatment-feed` records ready for bounded fetching without documentary approval.
- `009_legacy_treatment_endpoint_alignment.sql` repairs the exact untouched legacy homepage URL discrepancy.
- `010_provider_document_last_seen.sql` adds one timestamp to existing immutable source evidence, recording when identical raw JSON was most recently observed without overwriting its original retrieval metadata. Earlier migrations remain immutable.

Operators can edit the provider name, HTTPS endpoint, HTTP method, region key/optional container/code and bounded JSON parameters. Every edit clears obsolete approval metadata, updates the configured endpoint and resets pagination; this no longer blocks manual treatment fetches. Saving from the separate local administrator UI changes configuration only; a separate explicit collection action fetches the next bounded batch. The optional provider API key can be seeded from a server environment variable via `apiKeyEnv` in a local preset file; the UI intentionally cannot display or edit it. The reference portal does not use a key. Do not store real long-lived secrets in a committed preset: the current DB column stores the key as text and requires appropriate database access controls/encryption at rest for production. The key is not yet injected into HTTP requests; provider-specific authentication belongs to a verified adapter.

The internal `RestrictedSourceFetcher` enforces HTTPS, DNS/IP, direct TLS, MIME, size, timeout and retry restrictions. Legacy region-wide scheduling is no longer started; `REGION_SCAN_DAILY_UTC_HOUR` must be removed from deployment configuration. The 24-hour district coverage model is persisted by migration 011, but no district-fetch adapter is enabled without a verified provider request/filter contract. Legacy operator one-page fetching is diagnostic-only and never establishes district freshness.

## Reproducible provider presets

Run `pnpm db:migrate` before `pnpm provider:seed:saturn`. The command seeds `treatment-feed` from `apps/api/config/providers/fgis-saturn.json` without starting collection. Default re-runs never overwrite a user-customized connection; an explicit `--replace` clears legacy approval metadata and credentials. `source_catalog.url` stores the full endpoint, and `source_catalog.api_request_config` stores the structured request. See [Usage](USAGE.md#initialize-the-reference-provider-from-the-command-line).

## Future configuration

The AI agent's model/provider selection, credentials, tool permissions and run budgets are planned for `AGENT-01`; they are not current environment variables. Do not add speculative credentials or integration endpoints to the local runtime configuration.

### Manual treatment-feed ingest

The source URL and POST/GET parameters are persisted in `source_catalog` and editable through the loopback-bound administrator API. Migration 008 makes an existing `treatment-feed` with consistent endpoint/configuration eligible for manual fetching. `access_decision` and historical review metadata are preserved for compatibility with municipal sources; they are **not** treatment-feed fetch prerequisites. No permission document, evidence URL or operator-access approval step is required. The optional `api_key` is not sent by the reference adapter; other provider authentication adapters are not yet implemented. Structured source geometry requires technical validation before appearing on the public map with an unverified label; independent operator review remains optional and separate.

### Experimental live Saturn viewport retrieval

`SATURN_VIEWPORT_LIVE_ENABLED` defaults to `false`. Set `SATURN_VIEWPORT_LIVE_ENABLED=true` in the backend environment **only after reviewing provider access terms and the implications of storing the source response**. Restart the backend after changing this flag. The local beekeeper Web map (`127.0.0.1:5173`) has a provider-backed Smolensk district selector (Yartsevo `1477` is the offline catalog fallback), a database-only cache check and a one-page `Fetch up to 10 more records` action, while Admin provides a saved-index browser, an audit log and advanced diagnostics. The client route is restricted to a loopback peer and the local beekeeper browser `Origin` and must not be exposed to untrusted/public clients without real authentication and abuse protection. The provider configuration must still have an exact `bee-saturn.ru` API endpoint, the migrations (including 013, 014 and 015) must be applied, and the source-wide 20-second minimum gap is never bypassed. A `SOURCE_THROTTLED` response is expected if another retrieval has reserved the recent slot. The feature does not enable district-wide refresh, scheduled collection, publicly served treatment records, or automatic upstream requests when the map moves.

The read-only Web status lookup after selecting a bounded viewport only checks stored PostGIS checkpoints. The Admin cache history endpoint also reads PostgreSQL without fetching upstream data. A saved viewport index lists field centers, not polygons or verified treatment notices.

### District-directory and audit upgrade (migration 015)

After applying the new ZIP run `pnpm db:migrate` before `pnpm dev`. `SATURN_VIEWPORT_LIVE_ENABLED=true` enables _explicit_ local browser/operator clicks only, subject to reviewed provider access rights. The Web district selector initially offers the previously verified Yartsevo fallback; click **Fetch all districts from Saturn** to load the provider's `/backend/beemaster/district/55` directory into PostGIS. Subsequent launches read it from the DB, without contacting the provider. Directory refresh and `/query` fetches share the 20-second PostgreSQL throttle; a click can receive `SOURCE_THROTTLED`. Prior 65-second reservations are retained until they expire; the new interval applies on the next successful reservation. This 20-second local-pilot default is a conservative application setting, not a provider-published allowance: obey any stricter upstream policy, throttle response or access restriction. Web discards any delayed initial catalog read after a user-triggered refresh and shows the number of districts actually returned. Requests use a fixed browser-compatible JSON Accept/Accept-Language/Content-Type profile plus first-party Origin (POST) and Referer headers on the two exact allowlisted Saturn endpoints. They retain a truthful MelliAtlas User-Agent, verified HTTPS/DNS and no cookies, login, browser fingerprint impersonation or anti-bot circumvention. If access is denied, stop rather than attempting to bypass it.

`source_saturn_request_log` stores explicit directory and viewport attempts, including failures, as sanitized structured rows; `source_saturn_district_catalog` stores the last verified directory response. View recent attempts and saved index groups in Admin → Data Collection. Old `/planapplybees` diagnostic results use a separate existing run history and do not appear in this new attempt log. Neither directory entries nor center points indicate treatment or completed district coverage. Disable upstream fetching immediately by unsetting or setting `SATURN_VIEWPORT_LIVE_ENABLED=false`; read-only inspection remains available.
