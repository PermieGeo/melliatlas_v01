# Local Administrator HTTP Client Contract

**Owner:** `apps/admin/src/api/`. **Public API:** `client.ts` functions.

- Exposes revision-aware provider configuration, explicit bounded manual import, pending-record review, preview geometry, and source/status reads through `/api/v1/operator/*`.
- Exposes read-only Saturn saved viewport history, field IDs, cached directory and sanitized request logs; explicit `/next` or directory refresh is the only new Saturn traffic.
- Validates responses with `@melliatlas/contracts`; a configuration save never fetches.
- All provider network access and throttling remain server-side. The current loopback/origin restriction is **not** production administrator authentication.
