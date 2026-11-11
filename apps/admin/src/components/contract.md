# Local Administrator UI Component Contract

**Owner:** `apps/admin/src/components/`.

- `ProviderConfigurationForm`, `CollectionPanel`, and `ReviewPanel` separate settings, explicitly requested ingestion and evidence-backed review.
- `MapPreview`, `PreviewFieldDetails`, and `MapAnalysisPanel` present available sourced polygons and review states without implying treatment coverage or risk.
- Saturn panels expose saved viewport checkpoints, bounded stored field IDs, request audit, and explicit one-page collection; legacy region-scan/district-refresh controls must not suggest an active scheduled collector.
- `HelpPage` and `FieldHelp` present localized guidance without provider fetches.
- Components delegate all HTTP to `apps/admin/src/api/` and never export administrator capabilities to the beekeeper UI.
