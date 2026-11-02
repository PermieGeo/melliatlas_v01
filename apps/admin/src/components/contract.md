# Administrator Component Contract

**Owner:** `apps/admin/src/components/`.

- `ProviderConfigurationForm` owns revision-aware provider editing only; save never fetches a provider page.
- `CollectionPanel` owns explicit bounded collection and read-only source status.
- `ReviewPanel` owns pending records and evidence-backed publication decisions.
- `MapPreview` renders pending and verified polygons with distinct styles and original citations.
- Components use `apps/admin/src/i18n.ts` for user-facing copy and delegate HTTP to `apps/admin/src/api/`.
- No browser-side shared operator token or login is implemented in this local-only slice.
