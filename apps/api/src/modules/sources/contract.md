# Source Ingestion Module Contract

**Owner:** `apps/api/src/modules/sources/`. **Status:** internal schemas and URL-policy preflight only. Ingestion is not running.

- **Responsibility:** Define source-ingestion metadata and enforce operator-reviewed destination allowlists before any future network access.
- **Public entry points:** [contracts.ts](contracts.ts) exports source, fetch policy, document, run and notice candidate schemas/types; [destinationPolicy.ts](destinationPolicy.ts) exports `evaluateSourceDestination` with a typed decision.
- **Owned data:** Internal source and extraction contracts. The persisted catalog still belongs to [database infrastructure](../../db/contract.md); these contracts are not wired to that table. No source documents or notices are written.
- **Allowed dependencies:** Zod and Node's IP-literal parser. Neither entry point accesses the database or network.
- **Forbidden:** Arbitrary URL fetching, implicit approval of publicly visible sites, unchecked redirects, synthetic notices, or exposing operator review details through public API routes.
- **Invariants:** Fetch eligibility requires an enabled source, explicit access review with evidence, exact-match HTTPS DNS host and approved path prefix. `/notices` admits `/notices/2026` but not `/notices-private`. IP literals, URL credentials, fragments and encoded traversal/separators fail closed. Current notice candidates are restricted to `text_only` until geometry normalization exists; verified candidates need evidence excerpts.
- **Critical limit:** The pure preflight **does not prevent DNS rebinding or public DNS names resolving to private addresses**. Before any HTTP fetch, enforce IP checks on DNS answers and actual connected addresses, recheck redirects and proxy behavior, and bound content size, MIME, time, retries and concurrency.
- **Extension:** Add approved adapters, restricted transport, additive migration and durable ingestion repositories. Spatial claims require independent geometry validation. Public wire schemas belong to `packages/contracts` once endpoints exist.
