# Beekeeper UI Component Contract

**Owner:** `apps/web/src/components/`.

- `MapCanvas` displays a selectable WGS84 map, source-attributed notice polygons with review status, and visually separate, unverified Saturn field-center markers.
- `TreatmentDetailsPanel` and `WeatherPanel` present source links, available facts, uncertainty, forecast provenance, and empty/error states; neither produces a pesticide safety verdict.
- `DistrictViewportPanel` exposes cached district selection, read-only index inspection and **explicit** one-page/directory fetch controls. Changing selection, pan, or zoom must not fetch upstream data.
- `HelpPage` displays validated, localized, plain-text guides.
- Components use the browser API client and localization catalogs; they do not import server internals or administrator APIs. A cached index is not a treatment overlay.
