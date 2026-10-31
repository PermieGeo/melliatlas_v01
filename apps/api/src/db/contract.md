# Database Infrastructure Contract

**Owner:** `apps/api/src/db/`. **Status:** implemented foundation for `SRC-01`.

- **Responsibility:** PostgreSQL connection pool, ordered checksummed SQL migrations, source catalog query.
- **Public entry points:** [pool.ts](pool.ts) `createDatabasePool`; [sourceRepository.ts](sourceRepository.ts) `SourceRepository.list`; migration command [migrate.ts](migrate.ts).
- **Owned data:** SQL schema defined in [001_source_core.sql](../../migrations/001_source_core.sql), including source catalog, run, document and spatial observation foundations.
- **Dependencies:** `pg` and shared public catalog schema; no browser or source-HTTP adapters.
- **Forbidden:** Expose raw query objects to HTTP clients, bypass schema validation, modify an applied migration, silently discard ingestion evidence.
- **Invariants:** Catalog responses conform to shared Zod schema; migrations use advisory lock, transaction and stored checksum. API readiness checks database connectivity.
- **Extension:** Future capability-owned repositories should keep SQL/data ownership explicit and expose narrow repository interfaces. Add numbered migrations for schema changes.
