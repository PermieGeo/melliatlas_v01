# Administrator Browser API Contract

**Owner:** `apps/admin/src/api/`.

- **Responsibility:** Same-origin API clients for local administrator configuration, manual collection, review queue and preview geometry.
- **Public entry points:** `loadProviderConfiguration`, `saveProviderConfiguration`, `loadProviderCollectionStatus`, `syncProviderPage`, `loadPendingTreatments`, `reviewTreatment`, `loadPreviewMapTreatments`, `loadSourceCatalog` in [client.ts](client.ts).
- **Dependencies:** Browser `fetch` and published `@melliatlas/contracts` schemas. Never fetch provider data directly from the browser.
- **Invariants:** Configuration saves do not fetch. Collection requests explicitly fetch one bounded page using backend restrictions. Preview data may be pending and must never be exposed through the beekeeper app.
- **Deployment:** Local loopback boundary only. Production administration requires backend authentication and network isolation before exposure.
