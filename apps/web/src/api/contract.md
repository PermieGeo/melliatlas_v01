# Beekeeper HTTP Client Contract

**Owner:** `apps/web/src/api/`. **Public API:** exported functions in `client.ts`, validated with `@melliatlas/contracts`.

- Weather inspection and public notice retrieval read `/api/v1` without contacting external evidence providers from the browser.
- Local Saturn pilot functions read cached districts, field centers and exact-filter viewport progress; directory refresh and next-page fetch require explicit user actions on separate `/api/v1/map/saturn-viewport/*` routes.
- Responses are validated, and errors preserve server codes for localized presentation. Cached index centers are **not** treatment polygons, observations of spraying, or evidence of district coverage.
- This client must not call `/api/v1/operator/*`, synthesize observations, or expose provider secrets. The loopback-only fetch pilot needs real authentication before any public deployment.
