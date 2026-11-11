# Shared API Error Contract

**Owner:** `apps/api/src/lib/`. **Public API:** `ApiFailure` and `UpstreamUnavailable` from `errors.ts`.

- Expected failures carry stable error codes and HTTP status; the API composition root maps them to the shared error schema and request ID.
- Domain-specific errors remain with their owning modules unless multiple modules need the same semantics.
- No provider requests, database access, or raw upstream details belong in this module.
