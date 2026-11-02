# Using MelliAtlas

## Beekeeper map (`http://127.0.0.1:5173`)

Start PostgreSQL, run the migrations and `pnpm dev` as described in [Installation](INSTALLATION.md). Open the beekeeper frontend and use the map directly: select a point for attributed Open-Meteo forecast information, choose a view radius, toggle the treatment layer and refresh the map. The radius currently draws a visual circle; it does not run a spatial risk assessment.

Treatment polygons come **only from** `GET /api/v1/notices`, the PostGIS-backed source-attributed layer. Technically valid structured plans may be shown with `pending` review status and an explicit unverified warning; operator-verified plans have a separate label. Rejected, unlocated and unstructured pending claims are hidden. If the map is empty, it does **not** prove treatments are absent. Map refresh never requests data from the external provider. The interface has RU/EN localization for its current primary messages; original provider names and source evidence are not translated.

## Local administrator (`http://127.0.0.1:5174`)

The admin interface has four independent sections:

- **Data collection:** displays persisted collection status and can explicitly request the **next bounded batch** via `POST /api/v1/operator/provider/sync`. Import progress and incomplete region coverage must not be described as a complete refresh. The map preview shows unverified real polygons as dashed boundaries.
- **Sources:** reads the source catalog, including metadata and terms-review status.
- **Configuration:** reads and saves the provider endpoint, request method, region filter and JSON parameters with an optimistic revision check. Saving settings **never** fetches records.
- **Record review:** reads pending candidates; an operator can verify/reject individual candidates with a name and meaningful evidence note. Valid structured geometry can already appear as unverified; a review decision changes the public status to verified or removes rejected entries.

The current backend supports **one bounded provider page per manual request** and a minimum per-process source-request interval of 60 seconds. It does not implement full-region background downloads, a 10-minute freshness guarantee or event notifications yet. Region identifiers are provider-specific, not ISO national administrative identifiers. Actual usage rights and region mapping require verification.

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

| Method/path                                | Responsibility                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/notices`                      | Public source-attributed valid polygon layer (verified and structured pending), optional geographic bbox |
| `GET /api/v1/locations/inspect`            | Attributed forecast for one WGS84 point                                                                  |
| `GET /api/v1/sources`                      | Public source-catalog metadata                                                                           |
| `GET /api/v1/operator/provider`            | Local administrator settings                                                                             |
| `PUT /api/v1/operator/provider`            | Revision-checked provider settings, no fetch                                                             |
| `GET /api/v1/operator/provider/status`     | Ingestion status and counts                                                                              |
| `POST /api/v1/operator/provider/sync`      | Fetch one bounded provider page                                                                          |
| `GET /api/v1/operator/notices/map-preview` | Pending and verified admin preview                                                                       |
| `GET /api/v1/operator/notices`             | Pending review queue                                                                                     |
| `POST /api/v1/operator/notices/:id/review` | Evidence-backed review decision                                                                          |

All external provider requests originate on the backend and apply HTTPS destination, DNS/IP, timeout, payload and rate-limit restrictions. Source geometry must pass technical validation before public display; optional operator review remains separately auditable. Neither a pending plan nor an operator-reviewed plan establishes a scientific pesticide safety verdict. Public reuse permissions must be checked before internet deployment.
