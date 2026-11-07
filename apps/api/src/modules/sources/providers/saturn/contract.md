# Saturn Provider Adapter Contract

**Owner:** `apps/api/src/modules/sources/providers/saturn/`.

- **Purpose:** Own Saturn-specific endpoint identities, the strict request-header profile, and the source registration used by the existing explicit viewport pilot.
- **Public entry points:** `sourceProfile.ts` exports the fixed source ID, allowlisted endpoints, and `saturnJsonSource()`; `requestProfile.ts` exports `SATURN_JSON_PROFILE_ID` and its immutable request-profile registration.
- **Dependencies:** The source-ingestion module's typed fetch contracts, source registry schema, and shared request pacing constant. No direct network or database access.
- **Transport boundary:** `RestrictedSourceFetcher` accepts an optional, trusted, explicitly registered profile. A profile may only be used by the matching source ID and one of its exact URLs. Independently, the fetcher still enforces reviewed source destinations, DNS/IP/TLS restrictions, MIME, size, redirect, timeout, and retry policy. Unregistered profile IDs fail before DNS.
- **Header restrictions:** The profile describes a fixed first-party JSON request context, not authentication or browser impersonation. The shared transport constructs its own `User-Agent`, `Accept-Encoding`, and body length; no provider-controlled cookies, authorization tokens, or arbitrary header names are accepted.
- **Invariants:** Initial application reads never start Saturn traffic; source access remains disabled without operator opt-in. Each live request must use the shared PostgreSQL reservation. The two configured URLs do not authorize any other Saturn path or infer historical district coverage.
- **Next extraction:** Move the existing Saturn-specific query, parsing, directory, viewport, and persistence owners into this provider boundary in subsequent behavior-preserving increments. Do not conflate provider map-index pages with treatment details or district completeness.
