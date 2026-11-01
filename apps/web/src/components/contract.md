# Map and Operator Settings Components Contract

**Owner:** `apps/web/src/components/`. **Status:** implemented map with verified provider polygons and authenticated manual source editor/review controls.

- **Responsibility:** Reusable Leaflet map visualization plus a scoped authenticated provider operator configuration form.
- **Public entry point:** `MapCanvas` and its typed props in [MapCanvas.tsx](MapCanvas.tsx), and [ProviderSettings](ProviderSettings.tsx).
- **Owned data:** Transient Leaflet map state; selection and weather state remain in `App.tsx`. ProviderSettings owns ephemeral form state and in-memory operator token.
- **Dependencies:** React Leaflet, React hooks and shared Zod wire schemas through browser `api/client.ts`.
- **Forbidden:** Direct API/DB access, source-confidence inference, telemetry of private location, undocumented map attribution removal.
- **Invariants:** The provider editor never calls external providers directly or stores credentials in browser storage; authenticated review/sync actions are executed by the server under source-access policy. Selection callback reports WGS84 coordinates; radius is interpreted as kilometers and displayed in meters; region changes update the map center.
- **Extension:** New map overlays should use source-backed typed data, preserve provenance/precision and support touch/keyboard interaction.

- **Verified overlay:** `MapCanvas` accepts typed `MapTreatment[]`; only backend-reviewed Polygon/MultiPolygon geometries are rendered with source attribution and review caveats.

- **Manual feed workflow:** ProviderSettings exposes a direct token-protected one-page fetch after loading a configured provider, without a permission-approval form. The candidate review controls remain separate from source connection settings.
