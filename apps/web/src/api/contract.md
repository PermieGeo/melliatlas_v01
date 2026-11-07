# Beekeeper Browser API Contract

**Owner:** `apps/web/src/api/`.

- **Responsibility:** Same-origin `/api/v1` calls and strict schema validation for public map/weather data and the explicitly enabled local-only viewport-index pilot.
- **Public entry points:** `inspectLocation(point, signal)`, `loadMapTreatments(signal, bbox?)`, `loadDistrictViewportProgress(selection)` and `fetchDistrictViewportPage(selection)` in [client.ts](client.ts).
- **Invariants:** Map reads use `GET /api/v1/notices` with an optional viewport bbox (verified polygons and validated structured pending polygons with explicit review status). Never request `/api/v1/operator/*`, expose rejected or unlocated geometry, or create synthetic results on errors. The separate `POST /api/v1/map/saturn-viewport/{status,next}` is an explicit local-only, backend-gated pilot exception: ordinary map reads and navigation never initiate upstream collection, and index progress never implies polygon availability.
- **Error handling:** Parse language-neutral server error codes; localized display strings belong to UI catalogs, not the HTTP client.
