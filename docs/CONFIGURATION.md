# Configuration

This page is the reference for current runtime and persisted settings. See [Installation](INSTALLATION.md) for the first run and [Usage](USAGE.md) for the operator workflow.

## Backend environment

Copy `apps/api/.env.example` to `apps/api/.env` once, then edit the private file. Both the API and the migration command load environment variables through `dotenv` and validate API runtime configuration with Zod.

| Variable                | Default / example                                                          | Behavior                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`              | `development`                                                              | `development`, `test`, or `production`                                                                              |
| `PORT`                  | `3001`                                                                     | Backend port, integer 1–65535                                                                                       |
| `DATABASE_URL`          | `postgresql://melliatlas:local_development_only@127.0.0.1:5433/melliatlas` | Required PostgreSQL/PostGIS URL; port `5433` is the host-side Compose mapping                                       |
| `OPEN_METEO_TIMEOUT_MS` | `8000`                                                                     | Weather timeout in milliseconds, valid range 1000–30000                                                             |
| `SOURCE_OPERATOR_TOKEN` | Unset                                                                      | Optional, at least 32 characters; enables operator-only Provider settings endpoints when set                        |
| `SATURN_OPERATOR_TOKEN` | Unset                                                                      | **Legacy compatibility fallback** for operator authentication; new installations should use `SOURCE_OPERATOR_TOKEN` |

When both operator variables are configured, `SOURCE_OPERATOR_TOKEN` takes precedence. The token is an application-level authorization secret for `GET/PUT /api/v1/operator/provider`, **not** a third-party API token. Without either token, public weather/map/catalog routes continue to work; the operator routes return HTTP 503. Wrong or missing Authorization credentials return HTTP 401 when the operator API is enabled. Do not commit `.env` or paste secrets into logs. Use HTTPS to protect operator requests outside isolated localhost development.

The Compose database uses optional `POSTGRES_PASSWORD`, defaulting to `local_development_only`; PostgreSQL initializes credentials only when the persistent volume is first created. If you change the Compose password later, changing `DATABASE_URL` alone does not reset the existing database user's password. The database is bound to host loopback `127.0.0.1:5433`.

## Browser and local routing

`apps/web/vite.config.ts` configures port **5173** with `strictPort: true` and proxies `/api` to `http://127.0.0.1:3001`. The Vite host is not explicitly pinned in this version; use the **Local** URL printed at startup (normally `http://localhost:5173`). The application sends relative `/api/v1` requests and does not contain operator secrets in its build-time configuration. Deployment must implement equivalent API routing and HTTPS itself.

## Persisted candidate-provider settings

Source configuration is kept server-side in PostgreSQL. The operator UI calls `GET/PUT /api/v1/operator/provider`, backed by `ProviderConfigurationRepository`, with optimistic revision checking. Only **one** editable candidate treatment feed is supported at present.

- Migration `001_source_core.sql` creates the source catalog, ingestion evidence tables and PostGIS schema.
- `002_source_access_registry.sql` adds review decisions, URL allowlists, request limits and append-only policy history.
- `003_saturn_api_configuration.sql` creates a historical candidate row; the migration filename remains for compatibility and must not be rewritten.
- `004_provider_connection.sql` creates the neutral `treatment-feed` candidate and disables the legacy row without deleting its history.
- `005_treatment_source_approval.sql` permits explicit treatment-source approval **only when complete review metadata and policy are present**; it does not approve existing connections.
- `006_optional_provider_api_key.sql` adds nullable `api_key` to the existing `source_catalog` (which already contains `name`, `kind` and `url`) and excludes credentials from future policy snapshots.

Operators can edit the provider name, HTTPS endpoint, HTTP method, region key/optional container/code and bounded JSON parameters. Every edit revokes previous source approval and returns it to pending review. The web editor **cannot grant source access approval**. Configuring an endpoint does not create a fetch job, import source documents or display pesticide treatments. The optional provider API key can be seeded from a server environment variable via `apiKeyEnv` in a local preset file; the UI intentionally cannot display or edit it. The reference portal does not use a key. Do not store real long-lived secrets in a committed preset: the current DB column stores the key as text and requires appropriate database access controls/encryption at rest for production. The key is not yet injected into HTTP requests; provider-specific authentication belongs to a verified adapter.

An internal `RestrictedSourceFetcher` exists for explicitly approved source definitions, with DNS/IP restrictions, direct TLS, redirect policy and bounded requests. It is **not wired to the HTTP API or to a scheduler**. Live use additionally requires verified access/redistribution terms and a confirmed source-specific response contract.

## Reproducible provider presets

Run `pnpm db:migrate` before `pnpm provider:seed:saturn`. The command seeds `treatment-feed` from `apps/api/config/providers/fgis-saturn.json` without granting ingestion permission. Default re-runs never overwrite a user-customized connection; an explicit `--replace` clears prior approval and credentials. `source_catalog.url` stores the full endpoint, and `source_catalog.api_request_config` stores the structured request. See [Usage](USAGE.md#initialize-the-reference-provider-from-the-command-line).

## Future configuration

The AI agent's model/provider selection, credentials, tool permissions and run budgets are planned for `AGENT-01`; they are not current environment variables. Do not add speculative credentials or integration endpoints to the local runtime configuration.
