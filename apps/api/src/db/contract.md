# Database Infrastructure Contract

**Owner:** `apps/api/src/db/`.

- **Public APIs:** `createDatabasePool` in `pool.ts`, `SourceRepository.list()` in `sourceRepository.ts`, and the `migrate.ts` CLI.
- **Consumers:** server composition obtains a pool and public source catalog; capability-owned repositories consume the pool without exposing SQL rows as HTTP wire types.
- **Guarantees:** ordered checksummed SQL migrations, transactional migration execution and validated public catalog responses. Existing migrations are immutable.
- **Boundaries:** source evidence, review decisions, Saturn indexes, audits and other domain writes are owned by their respective source modules. PostgreSQL credentials and query objects are never exposed to clients.
- **Extension:** use a new numbered migration and a narrow capability-owned repository interface. Local demo-seeding commands may target only their explicit disposable demo databases.

Migration history and schema details are maintained in `apps/api/migrations/`; current ownership is summarized in [Modules](../../../../docs/MODULES.md), not duplicated here.
