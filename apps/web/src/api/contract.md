# Browser API Client Contract

**Owner:** `apps/web/src/api/`. **Status:** implemented.

- **Responsibility:** Call same-origin `/api/v1` endpoints, handle transport errors and validate response bodies.
- **Public entry points:** `inspectLocation(point, signal)`, `loadSourceCatalog(signal)` in [client.ts](client.ts).
- **Owned data:** No persistence; fetched values are managed by UI state owners.
- **Dependencies:** Browser `fetch` and `@melliatlas/contracts`.
- **Forbidden:** Database or backend-internal imports, direct secret-bearing provider calls, fabricated successful responses.
- **Invariants:** Calls accept an `AbortSignal`, parse responses through shared schemas and expose HTTP failures as errors.
- **Extension:** Add new clients here when server endpoints ship; keep provider-dependent parsing on the backend.
