# Frontend Rules

Extends [root AGENTS.md](../../AGENTS.md).

- Prefer feature-oriented UI modules. Each reusable feature module MUST keep a `contract.md` defining props/public hooks, owned state, allowed dependencies, invariants and accessibility behavior.
- `src/App.tsx` is the UI composition root. Business decisions and HTTP decoding belong in owning modules, not copied into multiple components.
- Browser data access lives behind `src/api/` and shared `@melliatlas/contracts` schemas; never import `apps/api` source or connect to PostgreSQL directly.
- Keep map-first UX on mobile and desktop: touch-sized controls, no horizontal overflow, accessible keyboard paths, responsive details and cancellable requests.
- Render verified server values only. Loading, empty, stale, restricted and error states differ; every external finding shows source and timestamp.
- Never imply forecast weather proves pesticide risk, flowering state, official spraying or satellite observations.
- Do not send precise private apiary coordinates to third parties, analytics, map URLs or error trackers.
- Keep provider attribution on map layers. Verify external map tile/data usage restrictions before production launch.
- Use component tests and Playwright desktop/mobile E2E for user-visible behavior; avoid tests against live external providers.
- All documentation and comments are English; localized interface strings are allowed. See [USAGE](../../docs/USAGE.md) and [TESTS](../../docs/TESTS.md).
