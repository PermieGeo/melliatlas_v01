# Browser API Client Contract

**Owner:** `apps/web/src/api/`. **Status:** implemented for the localhost administrator UI.

- **Responsibility:** Same-origin `/api/v1` requests, typed response/error validation and cancellation of map reads.
- **Public entry points:** `inspectLocation(point, signal)`, `loadSourceCatalog(signal)`, `loadProviderConfiguration()`, `saveProviderConfiguration(input)`, `loadProviderCollectionStatus()`, `syncProviderPage()`, `loadPendingTreatments()`, `reviewTreatment(...)`, and `loadMapTreatments(signal)` in [client.ts](client.ts).
- **Dependencies:** Browser `fetch` and `@melliatlas/contracts`; no direct provider request or database access.
- **Invariants:** No bearer token is stored or sent; editing requires the local administrator deployment boundary. `loadMapTreatments` reads `/api/v1/operator/notices/map-preview`, which can include validated unverified polygons; these must not be represented as published claims. Public `/api/v1/notices` remains verified only.
- **Extension:** A future public-facing application must not include operator routes, unverified preview or unauthenticated configuration controls.
