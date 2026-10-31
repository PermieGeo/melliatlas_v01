# Web-Specific Instructions

Extends [root AGENTS.md](../../AGENTS.md).

- Follow the supplied map-first reference design: light slate canvas, white cards, amber/emerald accents, responsive navigation, interactive Leaflet map and a contextual location panel.
- Optimize for both desktop and mobile. On narrow screens, the map remains primary, controls are touch-sized, and detail cards stack without horizontal scrolling.
- Display only server-provided data as evidence. Empty/loading/stale/error/unsupported states are explicit, accessible and distinct.
- Render all external findings with source links, time and review status. Never infer an official notice or actionable pesticide-safety conclusion from weather alone.
- Keep requests cancellable when a map selection changes. Avoid unbounded network queries on every map pan.
- User coordinates are never persisted or sent to third parties beyond the clearly documented live inspection request.
- Map layers must include correct provider attribution and must not label a basemap as satellite-derived phenology analysis.
- Use browser/Playwright tests for interaction, mobile viewport, keyboard operation and recoverable API failures.
