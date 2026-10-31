# Map Presentation Contract

**Owner:** `apps/web/src/components/`. **Status:** implemented map view.

- **Responsibility:** Reusable Leaflet map visualization, center updates, selected point and radius overlay.
- **Public entry point:** `MapCanvas` and its typed props in [MapCanvas.tsx](MapCanvas.tsx).
- **Owned data:** Transient Leaflet map state; selection and remote data state remain in `App.tsx`.
- **Dependencies:** React Leaflet, React hooks and shared WGS84 `Coordinates` type.
- **Forbidden:** Direct API/DB access, source-confidence inference, telemetry of private location, undocumented map attribution removal.
- **Invariants:** Selection callback reports WGS84 coordinates; radius is interpreted as kilometers and displayed in meters; region changes update the map center.
- **Extension:** New map overlays should use source-backed typed data, preserve provenance/precision and support touch/keyboard interaction.
