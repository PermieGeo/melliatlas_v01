# Administrator Component Contract

**Owner:** `apps/admin/src/components/`.

- `ProviderConfigurationForm` owns revision-aware provider editing only; save never fetches a provider page.
- `CollectionPanel` owns explicit one-page collection and read-only source status; `DistrictCachePanel` shows read-only district coverage and a disabled refresh action until the upstream district contract is verified; the former full-region scan controls are retired from this UI.
- `ReviewPanel` owns pending records and evidence-backed publication decisions.
- `MapAnalysisPanel` summarizes only the records returned by the current preview response (total, reviewed, not independently reviewed). It must not claim historical coverage, actual spraying, risk or forecasting. This compact panel belongs below the independent administrator map; richer analytics is a separate future capability.
- `MapPreview` renders pending and verified polygons with distinct styles. Polygon selection updates the persistent `PreviewFieldDetails` sidebar with source claims, review status and the original citation, without map popups or provider calls. The selection is discarded when its record disappears after a refresh.
- `HelpPage` loads the localized administrator guide from `apps/admin/public/help/<locale>.json` when opened. It validates the shared help document contract, displays sections, steps and synthetic examples as plain text, and reports loading/errors without contacting the provider.
- `FieldHelp` provides a keyboard-accessible explanation beside ambiguous controls. Help closes on a second trigger activation, a click outside, or Escape; interacting inside the explanation does not dismiss it. All help copy, temporary-function notices and planned replacements live in the RU/EN message catalogs. The one-page import is labelled development-only with its planned district-cache replacement; district refresh is labelled in development and remains disabled.
- Components use `apps/admin/src/i18n.ts` for user-facing copy and delegate HTTP to `apps/admin/src/api/`.
- No browser-side shared operator token or login is implemented in this local-only slice.
