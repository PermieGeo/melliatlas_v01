# API-Specific Instructions

Extends [root AGENTS.md](../../AGENTS.md).

- Own all provider credentials and remote data access. Browsers must never contact protected sources using backend secrets.
- Route -> application service -> source adapter or repository -> typed contract. Keep provider-specific fields out of HTTP handlers.
- Validate every external request, internal provider payload and persisted record with strict schemas; reject invalid/ambiguous input.
- Enforce request size limits, timeouts, bounded concurrency, retry budgets and sanitized logs. Crawlers must use an explicit hostname allowlist and redirect validation to prevent SSRF.
- PostgreSQL/PostGIS migrations must be additive, ordered and replay-safe. Never infer a destructive migration from an older prototype.
- Preserve source timestamps, original source URLs, ingestion run IDs, content hashes, record versions and error classification. Separate source-published facts from model-extracted assertions.
- Prevent raw notices, web pages, instructions embedded in source content or prompts from acquiring tool/SQL/network privileges.
- Tests use local HTTP stubs and fixtures with explicit fake labels; production endpoints never expose test fixtures.
- When a provider, license or scientific assumption is unverified, represent it as an open decision and fail closed.
