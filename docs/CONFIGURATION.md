# Runtime Configuration

The application runs locally with a PostgreSQL/PostGIS container and three host processes. Follow [Installation](INSTALLATION.md) to create `apps/api/.env`; use [Diagnostics](DIAGNOSTIC.md) for failures. Keep secrets out of Git.

## Backend settings

| Setting                        | Default / example                 | Meaning                                                                                          |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                     | `development`                     | `development`, `test` or `production`                                                            |
| `PORT`                         | `3001`                            | API listener port                                                                                |
| `DATABASE_URL`                 | Local PostGIS on `127.0.0.1:5433` | Required by API and migrations; match the database's initialized password                        |
| `OPEN_METEO_TIMEOUT_MS`        | `8000`                            | Weather request timeout (1,000–30,000 ms)                                                        |
| `SATURN_VIEWPORT_LIVE_ENABLED` | `false`                           | Opts in to explicit **local-only** Saturn district/viewport requests; review source access first |

The retired `REGION_SCAN_DAILY_UTC_HOUR` option does nothing and should not be configured. `apps/web` and `apps/admin` use Vite's relative `/api` proxy to the local API (ports 5173 and 5174). The development Compose database binds to loopback port 5433. See the [module map](MODULES.md) for ownership.

## Treatment provider settings

The operator **Configuration** view stores a versioned connection for the `treatment-feed` source in PostgreSQL: provider name, full HTTPS endpoint, method, region key/code and bounded request parameters. Saving a revision resets its pagination and approval-related state but does **not** download data. Explicit one-page collection is a separate action.

After applying migrations, seed the optional candidate preset with:

```bash
pnpm provider:seed:saturn
```

The preset comes from `apps/api/config/providers/fgis-saturn.json`. Re-running the seed preserves customized settings; `pnpm --dir apps/api provider:seed config/providers/fgis-saturn.json --replace` intentionally replaces them and clears associated credentials/cursors. Neither command contacts Saturn. The preset is not an authorization to automate retrieval or republish source data; see the [source evidence register](source-register.md).

The optional persisted provider API key is not sent by the current treatment adapter. Do not place long-lived keys in committed presets. The local operator interface uses loopback/origin restrictions **without production-grade authentication**; do not expose it to an untrusted network.

## Saturn viewport pilot

`SATURN_VIEWPORT_LIVE_ENABLED=true` enables only explicit directory and one-page viewport-index requests from the local Web/Admin interfaces. It does not enable scheduled scans, whole-district refresh, or map-pan downloads. Requests share the persisted source-wide minimum **20-second** spacing; this is an application limit, not a provider-granted request rate. A throttled request may return `SOURCE_THROTTLED`. Cached reads remain available with the flag disabled.

The fetched index contains field **centers**, not treatment polygons or proof of application. Source permissions, safe retrieval, provider semantics and allowed redistribution require separate verification before broader use.

An AI model/provider selector and LLM tool budgets are not yet runtime settings: the core analysis graph is a scaffold, not an enabled AI adviser.
