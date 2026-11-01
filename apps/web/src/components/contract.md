# Map and Operator Settings Components Contract

**Owner:** `apps/web/src/components/`. **Status:** implemented map view and inert Saturn connection editor.

- **Responsibility:** Reusable Leaflet map visualization plus a scoped authenticated Saturn operator configuration form.
- **Public entry point:** `MapCanvas` and its typed props in [MapCanvas.tsx](MapCanvas.tsx), and [SaturnSettings](SaturnSettings.tsx).
- **Owned data:** Transient Leaflet map state; selection and weather state remain in `App.tsx`. SaturnSettings owns ephemeral form state and in-memory operator token.
- **Dependencies:** React Leaflet, React hooks and shared Zod wire schemas through browser `api/client.ts`.
- **Forbidden:** Direct API/DB access, source-confidence inference, telemetry of private location, undocumented map attribution removal.
- **Invariants:** The Saturn editor never fetches external data, stores credentials or overrides the server-side source-access policy. Selection callback reports WGS84 coordinates; radius is interpreted as kilometers and displayed in meters; region changes update the map center.
- **Extension:** New map overlays should use source-backed typed data, preserve provenance/precision and support touch/keyboard interaction.
