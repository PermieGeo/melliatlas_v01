# Beekeeper Component Contract

**Owner:** `apps/web/src/components/`.

- `MapCanvas` renders reviewed source-backed WGS84 polygons, a selectable point and a configurable radius. It never performs provider requests or renders operator previews.
- `WeatherPanel` presents attributed forecast-model values, incomplete/loading/failure states and a retry action. Weather is not a pesticide safety assessment.
- Components receive selected locale and use `apps/web/src/i18n.ts` for user-facing messages.
- All backend reads originate in `apps/web/src/api/`, and beekeeper components must not import administrator modules or routes.
