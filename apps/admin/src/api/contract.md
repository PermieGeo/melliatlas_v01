# Administrator Browser API Contract

**Owner:** `apps/admin/src/api/`.

- **Responsibility:** Same-origin API clients for local administrator configuration, manual collection, review queue and preview geometry.
- **Public entry points:** `loadProviderConfiguration`, `saveProviderConfiguration`, `loadProviderCollectionStatus`, `syncProviderPage`, `loadPendingTreatments`, `reviewTreatment`, `loadPreviewMapTreatments`, `loadSourceCatalog` in [client.ts](client.ts).
- **Dependencies:** Browser `fetch` and published `@melliatlas/contracts` schemas. Never fetch provider data directly from the browser.
- **Invariants:** Configuration saves do not fetch. Collection requests explicitly fetch one bounded page using backend restrictions. The administrator preview endpoint and review queue must never be called by the beekeeper app; independently, the public notices API may contain validated structured pending polygons with explicit status.
- **Deployment:** Local loopback boundary only. Production administration requires backend authentication and network isolation before exposure.

- `/api/v1/operator/provider/district-cache` exposes read-only district coverage with shared contract validation. The refresh command is disabled until a verified upstream district filter is available. The former full-region frontend workflow is retired; the backend retains only compatibility routes that cannot run without a wired legacy worker.
