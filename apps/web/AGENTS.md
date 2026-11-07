# Frontend Rules

Extends [root AGENTS.md](../../AGENTS.md).

- Prefer feature-oriented UI modules. Each reusable feature module MUST keep a `contract.md` defining props/public hooks, owned state, allowed dependencies, invariants and accessibility behavior.
- `src/App.tsx` is the UI composition root. Business decisions and HTTP decoding belong in owning modules, not copied into multiple components.
- Browser data access lives behind `src/api/` and shared `@melliatlas/contracts` schemas; never import `apps/api` source or connect to PostgreSQL directly.
- Keep map-first UX on mobile and desktop: touch-sized controls, no horizontal overflow, accessible keyboard paths, responsive details and cancellable requests.
- Only `GET /api/v1/notices` returns map treatment records for beekeepers. Never call `/api/v1/operator/*` or bundle admin controls into this app. The separate local-only explicit pilot action `/api/v1/map/saturn-viewport/next` may request exactly one bounded map-index page with server-side gating; it must never run on map movement or be represented as a polygon layer.
- Render only server-provided source-attributed data. Pending structured treatment polygons may appear with a prominent unverified label; never represent them as independently reviewed or as a pesticide-risk verdict. Loading, empty, stale, restricted and error states differ; every external finding shows source and timestamp.
- Never imply forecast weather proves pesticide risk, flowering state, official spraying or satellite observations.
- Do not send precise private apiary coordinates to third parties, analytics, map URLs or error trackers.
- Keep provider attribution on map layers. Verify external map tile/data usage restrictions before production launch.
- Use component and Playwright desktop/mobile tests for success, empty, failure, retry, source links, selection changes and accessibility. Stub only external boundaries, not the logic being tested. Verify real FE/BE integration separately from browser-only fixtures.
- All documentation and comments are English; localized interface strings are allowed. See [USAGE](../../docs/USAGE.md) and [TESTS](../../docs/TESTS.md).
