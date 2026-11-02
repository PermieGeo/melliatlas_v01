# Configuration

This page is the reference for current runtime and persisted settings. See [Installation](INSTALLATION.md) for the first run and [Usage](USAGE.md) for the operator workflow.

## Backend environment

Copy `apps/api/.env.example` to `apps/api/.env` once, then edit the private file. Both the API and the migration command load environment variables through `dotenv` and validate API runtime configuration with Zod.

| Variable                | Default / example                                                          | Behavior                                                                      |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`              | `development`                                                              | `development`, `test`, or `production`                                        |
| `PORT`                  | `3001`                                                                     | Backend port, integer 1–65535                                                 |
| `DATABASE_URL`          | `postgresql://melliatlas:local_development_only@127.0.0.1:5433/melliatlas` | Required PostgreSQL/PostGIS URL; port `5433` is the host-side Compose mapping |
| `OPEN_METEO_TIMEOUT_MS` | `8000`                                                                     | Weather timeout in milliseconds, valid range 1000–30000                       |

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
- `009_legacy_treatment_endpoint_alignment.sql` repairs the exact untouched legacy homepage URL discrepancy. Earlier schema migrations remain immutable.

Operators can edit the provider name, HTTPS endpoint, HTTP method, region key/optional container/code and bounded JSON parameters. Every edit clears obsolete approval metadata, updates the configured endpoint and resets pagination; this no longer blocks manual treatment fetches. Saving from the separate local administrator UI changes configuration only; a separate explicit collection action fetches the next bounded batch. The optional provider API key can be seeded from a server environment variable via `apiKeyEnv` in a local preset file; the UI intentionally cannot display or edit it. The reference portal does not use a key. Do not store real long-lived secrets in a committed preset: the current DB column stores the key as text and requires appropriate database access controls/encryption at rest for production. The key is not yet injected into HTTP requests; provider-specific authentication belongs to a verified adapter.

The internal `RestrictedSourceFetcher` allows configured manual treatment requests and separately approved municipal registrations while enforcing HTTPS, DNS/IP, direct TLS, redirect, MIME, size, timeout and retry restrictions. It is used by the local administrator ingest endpoint; there is no scheduler.

## Reproducible provider presets

Run `pnpm db:migrate` before `pnpm provider:seed:saturn`. The command seeds `treatment-feed` from `apps/api/config/providers/fgis-saturn.json` without starting collection. Default re-runs never overwrite a user-customized connection; an explicit `--replace` clears legacy approval metadata and credentials. `source_catalog.url` stores the full endpoint, and `source_catalog.api_request_config` stores the structured request. See [Usage](USAGE.md#initialize-the-reference-provider-from-the-command-line).

## Future configuration

The AI agent's model/provider selection, credentials, tool permissions and run budgets are planned for `AGENT-01`; they are not current environment variables. Do not add speculative credentials or integration endpoints to the local runtime configuration.

### Manual treatment-feed ingest

The source URL and POST/GET parameters are persisted in `source_catalog` and editable through the loopback-bound administrator API. Migration 008 makes an existing `treatment-feed` with consistent endpoint/configuration eligible for manual fetching. `access_decision` and historical review metadata are preserved for compatibility with municipal sources; they are **not** treatment-feed fetch prerequisites. No permission document, evidence URL or operator-access approval step is required. The optional `api_key` is not sent by the reference adapter; other provider authentication adapters are not yet implemented. Candidate geometry still requires data-quality verification before appearing on the public map.
