# Shared Wire-Contract Rules

Extends [root AGENTS.md](../../AGENTS.md). Read [contract.md](contract.md) first.

- Own `/api/v1` JSON request/response schemas and inferred TypeScript types. Keep them independent of FE/BE implementation and external providers.
- Use strict Zod schemas with explicit nullability, UTC time formats, WGS84 coordinates, source provenance and review status.
- Preserve compatibility within a published API version; breaking changes require an explicitly versioned endpoint.
- One public schema owner: never copy schemas independently into backend and frontend.
- Update corresponding API/web consumers and contract tests together.
- Do not import React, Express, Node APIs, database code or provider-specific clients.
- Keep `contract.md` current when adding a public schema.
- Documentation and comments are English.
