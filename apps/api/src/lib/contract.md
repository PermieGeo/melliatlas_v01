# API Error Contract

**Owner:** `apps/api/src/lib/`. **Status:** implemented.

- **Responsibility:** Transport-neutral typed errors for expected API/provider failures.
- **Public entry points:** `ApiFailure` and `UpstreamUnavailable` from [errors.ts](errors.ts).
- **Owned data:** None.
- **Dependencies:** Built-in runtime only.
- **Forbidden:** HTTP route registration, provider network requests, database access, raw upstream stack traces in user responses.
- **Invariants:** Known failures retain HTTP status and stable error code; the HTTP composition root maps errors to shared `apiErrorSchema` with a request ID.
- **Extension:** Add domain-specific errors inside the domain module; publish a common error type here only if multiple modules share its semantics.
