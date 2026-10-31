# Weather Module Contract

**Owner:** `apps/api/src/modules/weather/`. **Status:** implemented for `SRC-01`.

- **Responsibility:** Retrieve and validate current forecast-model weather for a WGS84 point; return source-attributed public weather.
- **Public entry point:** `OpenMeteoAdapter.inspect(Coordinates)` in [openMeteo.ts](openMeteo.ts). `RemoteFetcher` supports deterministic HTTP stubs.
- **Owned data:** No persistent tables; no user-specific state. Provider results exist only in the response.
- **Dependencies:** Shared `@melliatlas/contracts` and backend [error types](../../lib/contract.md); injected `fetch`, clock and timeout.
- **Forbidden:** Database access, unaudited arbitrary URLs, exposing provider payloads without validation, synthetic product fallback values or inference of treatment safety.
- **Invariants:** Fixed HTTPS provider, bounded request timeout, validated numeric fields, UTC timestamps and exact source attribution; invalid provider responses become `UpstreamUnavailable`.
- **Extension:** Other weather providers require explicit adapters and a documented source/provenance policy, not extra fields silently added to existing results.
