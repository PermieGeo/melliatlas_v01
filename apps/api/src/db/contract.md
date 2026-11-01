# Database Infrastructure Contract

**Owner:** `apps/api/src/db/`. **Status:** implemented foundation for `SRC-01`.

- **Responsibility:** PostgreSQL connection pool, ordered checksummed SQL migrations, source catalog query.
- **Public entry points:** [pool.ts](pool.ts) `createDatabasePool`; [sourceRepository.ts](sourceRepository.ts) `SourceRepository.list`; migration command [migrate.ts](migrate.ts).
- **Owned data:** SQL schema in [001_source_core.sql](../../migrations/001_source_core.sql) , additive [002_source_access_registry.sql](../../migrations/002_source_access_registry.sql) and [003_saturn_api_configuration.sql](../../migrations/003_saturn_api_configuration.sql). Migration 003 stores a legacy candidate endpoint and request parameters in the same revisioned registry. Migration 004 adds a provider-neutral connection row without rewriting legacy audit revisions. Migration 002 preserves legacy source rows as unapproved, adds source policy metadata and append-only revision snapshots; the municipal source module owns the policy read semantics.
- **Dependencies:** `pg` and shared public catalog schema; no browser or source-HTTP adapters.
- **Forbidden:** Expose raw query objects to HTTP clients, bypass schema validation, modify an applied migration, silently discard ingestion evidence.
- **Invariants:** Catalog responses conform to shared Zod schema; migrations use advisory lock, transaction and stored checksum. Approval requires reviewer evidence and source policy metadata. Policy changes increment the catalog revision and append a snapshot; routine cursor/freshness changes do not. API readiness checks database connectivity.
- **Extension:** Future capability-owned repositories should keep SQL/data ownership explicit and expose narrow repository interfaces. Add numbered migrations for schema changes.
