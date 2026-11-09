# Beekeeper Web Engineering Guidance

Extends [root engineering guidance](../../AGENTS.md). This application uses **React, TypeScript, Vite, Tailwind and Leaflet**.

- Organize UI by user capability. Keep `src/App.tsx` as a composition root; separate presentation, domain-oriented state/hooks, and API decoding when their responsibilities differ. Avoid duplicating business rules across components.
- Access the backend only through `src/api/` and validated `@melliatlas/contracts` schemas. Do not import backend internals, access PostGIS, call third-party treatment providers directly or include administrator functionality.
- Treatment observations come from the validated map API. The local Saturn viewport pilot may request **one** explicitly selected index page per click, never automatically on pan/zoom or as part of reading cached data. Display index centers separately from verified treatment geometry.
- Represent pending, verified, stale, empty and unavailable evidence distinctly. Show source attribution and timestamps; never turn a weather forecast, map marker or missing record into a pesticide safety verdict.
- Keep map use practical on mobile and desktop: accessible controls and focus order, touch targets, responsive layout, understandable loading/errors, and cleanup of obsolete asynchronous results after selection changes.
- All authored UI text must use the existing localized message catalogs and locale-aware formatting. Preserve source quotations as evidence, not translated application copy.
- Never leak future private apiary coordinates to third-party maps, telemetry or URLs.
- Cover relevant interactions, selection changes, failures and accessibility with component and desktop/mobile Playwright tests; distinguish stubbed UI evidence from real API integration.
