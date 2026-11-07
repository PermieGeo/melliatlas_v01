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

- `ViewportCollectionPanel` separately exposes an explicit, bounded Yartsevo map-index pilot: operator-editable bbox and UpdateMap dates, a read-only checkpoint query and a one-page fetch action. It does not automatically contact the upstream on render, selection change, pan or map zoom. State reports map index progress, not district freshness or verified spray events. Disabled backend mode is reported without hidden requests.

- The Data collection section now leads with a localized three-step guide to the **client-driven** pilot workflow on the local beekeeper map; low-level viewport coordinates are in a disclosure. Legacy single-page import and operator viewport diagnostics remain available for troubleshooting, not as the default beekeeper journey.

- `ViewportCacheHistoryPanel` reads the persisted local operator `/provider/viewport/history` endpoint and displays bounded recent `source_viewport_index_*` evidence from both Web and Admin, with per-page receipt timestamps. Refresh is read-only; the initiating UI identity is not stored. Field centers are distinct from treatment polygons and district completeness.

- The main Data Collection view begins with the saved PostGIS index history and `SaturnRequestLogPanel`, not raw bbox inputs. Each saved viewport can expand a bounded 100-field `StoredViewportFieldsPanel` listing IDs, plan IDs and source centers. The request audit includes unsuccessful attempts from both Admin and the map and is never a live provider poll. Legacy and manual viewport diagnostics are behind an advanced disclosure. No UI renders raw source JSON or interprets field centers as reported spraying.
