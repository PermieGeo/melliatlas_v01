# Beekeeper Browser API Contract

**Owner:** `apps/web/src/api/`.

- **Responsibility:** Read-only, same-origin `/api/v1` calls and strict schema validation for public map/weather data.
- **Public entry points:** `inspectLocation(point, signal)` and `loadMapTreatments(signal)` in [client.ts](client.ts).
- **Invariants:** Map reads use `GET /api/v1/notices` (verified records only). Never request `/api/v1/operator/*`, never expose pending geometry, never trigger remote ingestion, and never create synthetic results on errors.
- **Error handling:** Parse language-neutral server error codes; localized display strings belong to UI catalogs, not the HTTP client.
