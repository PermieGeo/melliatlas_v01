# Beekeeper Component Contract

**Owner:** `apps/web/src/components/`.

- `MapCanvas` renders reviewed source-backed WGS84 polygons, a selectable point and a configurable radius. It never performs provider requests or renders operator previews.
- `TreatmentDetailsPanel` shows the selected source-attributed field in a persistent right-side card beneath compact weather, with cadastral references listed vertically and no inferred risk judgement. Selecting a polygon updates this panel without opening a Leaflet popup or automatically panning the map. `TreatmentFacts` is used only by the sidebar.
- `WeatherPanel` presents attributed forecast-model values, incomplete/loading/failure states and a retry action. Weather is not a pesticide safety assessment.
- `HelpPage` loads RU/EN plain-text guidance on demand from `apps/web/public/help/<locale>.json`, validates its structure using `helpDocumentSchema`, and renders sections, steps and warnings without executing HTML. It offers retry on missing/invalid content and does not call provider or operator APIs.
- Components receive selected locale and use `apps/web/src/i18n.ts` for user-facing messages.
- All backend reads originate in `apps/web/src/api/`, and beekeeper components must not import administrator modules or routes.

- `DistrictViewportPanel` owns the explicit local-pilot workflow for the observed Yartsevo viewport map index. The user selects the verified district, confirms the visible Leaflet rectangle and `UpdateMap` dates, and explicitly requests at most one upstream page through the non-operator backend boundary. Moving the map or selecting a district never starts collection. The panel validates the same shared Zod selection, resets stale progress after changes, presents source cooldown/disabled/errors, and clearly distinguishes field-center index entries from stored treatment polygons or district completeness. The selectable district list is intentionally limited to the verified pilot ID `1477`.

- `DistrictViewportPanel` exposes at most 100 cached WGS84 feature centers to `MapCanvas` after a debounced read-only cache inspection or an explicitly requested page. `MapCanvas` renders them as blue point markers, never as sprayed polygons; changing the exact bbox/date key clears old centers. Invalid windows (max 124 days) show an actionable message; supported date adjustment does not fetch data. No map movement triggers an upstream request.

- `DistrictViewportPanel` now reads a cached, validated provider district directory (all returned Smolensk districts/cities) and requests an explicit directory refresh only on a button click. Only the explicit page-fetch action can collect a `/query` page; status and district archive points read PostgreSQL. The historical district-wide center overlay is bounded at 500 distinct IDs and is independent of exact viewport/date progress; it may combine saved filters and is not a treatment layer. Previously observed Yartsevo remains a fallback until directory download. User-facing messages are localized and explain incomplete indexes.

- The district selector commits only the newest catalog read/refresh response: a delayed startup cache read may not overwrite an explicit successful refresh. Show the persisted directory count in RU/EN. The manual source-wide gate currently reserves at least 20 seconds between starts, subject to stricter provider access and rate limits.
