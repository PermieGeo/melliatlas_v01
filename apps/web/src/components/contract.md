# Beekeeper Component Contract

**Owner:** `apps/web/src/components/`.

- `MapCanvas` renders reviewed source-backed WGS84 polygons, a selectable point and a configurable radius. It never performs provider requests or renders operator previews.
- `TreatmentDetailsPanel` shows the selected source-attributed field in a persistent right-side card beneath compact weather, with cadastral references listed vertically and no inferred risk judgement. Selecting a polygon updates this panel without opening a Leaflet popup or automatically panning the map. `TreatmentFacts` is used only by the sidebar.
- `WeatherPanel` presents attributed forecast-model values, incomplete/loading/failure states and a retry action. Weather is not a pesticide safety assessment.
- `HelpPage` loads RU/EN plain-text guidance on demand from `apps/web/public/help/<locale>.json`, validates its structure using `helpDocumentSchema`, and renders sections, steps and warnings without executing HTML. It offers retry on missing/invalid content and does not call provider or operator APIs.
- Components receive selected locale and use `apps/web/src/i18n.ts` for user-facing messages.
- All backend reads originate in `apps/web/src/api/`, and beekeeper components must not import administrator modules or routes.
