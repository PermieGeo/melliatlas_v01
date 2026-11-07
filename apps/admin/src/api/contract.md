# Administrator Browser API Contract

**Owner:** `apps/admin/src/api/`.

- **Responsibility:** Same-origin API clients for local administrator configuration, manual collection, review queue and preview geometry.
- **Public entry points:** `loadProviderConfiguration`, `saveProviderConfiguration`, `loadProviderCollectionStatus`, `syncProviderPage`, `loadPendingTreatments`, `reviewTreatment`, `loadPreviewMapTreatments`, `loadSourceCatalog` in [client.ts](client.ts).
- **Dependencies:** Browser `fetch` and published `@melliatlas/contracts` schemas. Never fetch provider data directly from the browser.
- **Invariants:** Configuration saves do not fetch. Collection requests explicitly fetch one bounded page using backend restrictions. The administrator preview endpoint and review queue must never be called by the beekeeper app; independently, the public notices API may contain validated structured pending polygons with explicit status.
- **Deployment:** Local loopback boundary only. Production administration requires backend authentication and network isolation before exposure.

- `/api/v1/operator/provider/district-cache` exposes read-only district coverage with shared contract validation. The refresh command is disabled until a verified upstream district filter is available. The former full-region frontend workflow is retired; the backend retains only compatibility routes that cannot run without a wired legacy worker.

- `loadViewportProgress` and `fetchViewportNextPage` use shared selection/result schemas for the operator-only viewport index API. The former is read-only; the latter requests at most one upstream map-index page through backend policy. Neither calls `bee-saturn.ru` from the browser or retrieves/publishes polygon geometries.

- `loadViewportCacheHistory()` is an operator-only, read-only PostGIS cache journal endpoint. It returns at most 20 saved request keys and five page receipts per key, validated by `viewportCacheHistoryResponseSchema`. It never starts a provider fetch or returns raw provider JSON; the initiating client is not stored.
