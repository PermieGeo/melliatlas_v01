# Web Component Contract

**Owner:** `apps/web/src/components/`. **Status:** local administrator map and provider editor.

- **Responsibility:** `MapCanvas` renders sourced WGS84 polygons, region selection, radius and weather inspection without inventing geospatial features. `ProviderSettings` edits the configured provider and triggers one bounded page fetch upon successful save.
- **State:** React state is transient; source settings, ingestion and review are persisted by the backend. There are no browser-managed administrator tokens.
- **Invariants:** Pending polygons use a dashed amber boundary and an explicit unverified label; verified polygons use a solid boundary. Invalid/missing geometry is never drawn. Every feature retains original source attribution. Manual review needs a reviewer name and evidence note for publication, not for preview. External HTTP is performed only by the API.
- **Deployment boundary:** This UI is currently local-only; an independently deployed public client must exclude source editing, ingestion triggers and pending map preview.
