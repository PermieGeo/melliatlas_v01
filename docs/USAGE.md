# Using MelliAtlas

## Explore the map

1. Open `http://127.0.0.1:5173` after [installation](INSTALLATION.md).
2. Select a location in the Smolensk Oblast map or use a region shortcut.
3. Click or tap a point. The location panel requests current Open-Meteo forecast-model weather with the provider link and retrieval/observation timestamps.
4. Adjust the displayed inspection radius. It draws a circle around the selected point; it is **not** a search for nearby treatment notices in the current build.
5. Switch to **Data Sources** to see the database-backed source catalog and each entry's terms-review, lifecycle and last-ingestion status.

### Configure the Saturn endpoint (operator only)

Set a server-side `SATURN_OPERATOR_TOKEN` of at least 32 characters before starting the API. Visit the **Saturn Settings** tab, enter that token for this session, then edit the HTTPS endpoint, `GET`/`POST` method, regional parameter and code, and optional flat JSON parameters. Saving retains a numbered revision; concurrent changes require a reload. The token is held in UI memory and sent only in the Authorization header.

For an automated test or a future approved adapter, import `buildSaturnRequest(endpoint, settings)` from the backend source module; it accepts typed settings and returns an HTTP request description **without sending it**. The database candidate is not a permit to use external systems and `collectionEnabled` remains false. Do not use live data as a substitute for verified terms and API response semantics.

On phones, the layout uses mobile navigation and stacked controls. Map tiles and weather inspection require connectivity. A failed request appears as an error instead of substituted sample data.

## Current API

| Method and path                                       | Result                                      |
| ----------------------------------------------------- | ------------------------------------------- |
| `GET /health/live`                                    | Process liveness                            |
| `GET /health/ready`                                   | Database readiness; HTTP 503 if unavailable |
| `GET /api/v1/operator/saturn`                       | Authenticated, read-only candidate connection settings (no-store) |
| `PUT /api/v1/operator/saturn`                       | Authenticated validated edit with `expectedRevision`; no fetch |
| `GET /api/v1/sources`                                 | Catalog entries from PostgreSQL             |
| `GET /api/v1/locations/inspect?lat=54.782&lon=32.045` | Live Open-Meteo values and cited provenance |

Examples:

```bash
curl -i http://127.0.0.1:3001/health/ready
curl -i http://127.0.0.1:3001/api/v1/sources
curl -i 'http://127.0.0.1:3001/api/v1/locations/inspect?lat=54.782&lon=32.045'
```

Invalid coordinates return `400 INVALID_COORDINATES`. Provider failures return a typed error; rate limits return HTTP 429. Responses carry `X-Request-ID` for diagnostics. The catalog contains configured source metadata, not proof of a successful ingestion.

## Interpretation

- Weather is a **provider forecast-model result**, not an observed pesticide treatment or a safe/unsafe decision.
- Source status distinguishes configured, under-review and disabled sources. Last-ingestion time may be absent.
- Municipality notices, verified geospatial treatment overlays, private apiaries and the AI evidence agent are documented as planned work in [FEATURES](FEATURES.md) and the [active specifications](specs/README.md).

For failures, use [DIAGNOSTIC](DIAGNOSTIC.md).
