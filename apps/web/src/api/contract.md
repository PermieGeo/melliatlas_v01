# Beekeeper Browser API Contract

**Owner:** `apps/web/src/api/`.

- **Responsibility:** Read-only, same-origin `/api/v1` calls and strict schema validation for public map/weather data.
- **Public entry points:** `inspectLocation(point, signal)` and `loadMapTreatments(signal, bbox?)` in [client.ts](client.ts).
- **Invariants:** Map reads use `GET /api/v1/notices` with an optional viewport bbox (verified polygons and validated structured pending polygons with explicit review status). Never request `/api/v1/operator/*`, expose rejected or unlocated geometry, trigger remote ingestion, or create synthetic results on errors.
- **Error handling:** Parse language-neutral server error codes; localized display strings belong to UI catalogs, not the HTTP client.
