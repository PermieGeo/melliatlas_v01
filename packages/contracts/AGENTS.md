# Wire-Contract Instructions

Extends [root AGENTS.md](../../AGENTS.md).

- Export strict, serializable request and response schemas and inferred TypeScript types.
- Keep schema changes backward compatible within `/api/v1` or introduce a versioned endpoint deliberately.
- Do not import Node.js, React, database or source-provider libraries.
- Distinguish raw provider data, normalized observations, uncertainty and validated public claims.
- Document date/time units, coordinate reference system (WGS84), source provenance and nullable fields.
