# Browser API Client Contract

**Owner:** `apps/web/src/api/`. **Status:** implemented.

- **Responsibility:** Call same-origin `/api/v1` endpoints, handle transport errors and validate response bodies.
- **Public entry points:** `inspectLocation(point, signal)`, `loadSourceCatalog(signal)`, `loadProviderConfiguration(token)` and `saveProviderConfiguration(token, input)` in [client.ts](client.ts).
- **Owned data:** No persistence; fetched values are managed by UI state owners.
- **Dependencies:** Browser `fetch` and `@melliatlas/contracts`.
- **Forbidden:** Database or backend-internal imports, direct secret-bearing provider calls, fabricated successful responses.
- **Operator secrets:** Bearer tokens are passed only as Authorization headers, kept in component memory, never persisted by this module.
- **Invariants:** Calls accept an `AbortSignal`, parse responses through shared schemas and expose HTTP failures as errors.
- **Extension:** Add new clients here when server endpoints ship; keep provider-dependent parsing on the backend.

- `loadMapTreatments` consumes `GET /api/v1/notices` via shared schema and never calls a provider directly. Operator-only access review, bounded sync, pending queue and review mutations use an ephemeral bearer token.

- Operator-only import diagnostics are schema-validated by `providerCollectionStatusSchema`; no provider secret is persisted in the browser.
