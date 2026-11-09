# Shared API Contract Guidance

Extends [root engineering guidance](../../AGENTS.md). Read the package [contract](contract.md) before changing public schemas.

- Own the canonical Zod schemas and inferred TypeScript types for versioned `/api/v1` request/response data. Keep this package independent of React, Express, Node-specific APIs, PostGIS and provider implementations.
- Treat cross-app payloads as runtime data: validate structure, nullability, optionality, timestamps, WGS84 coordinates and review/provenance fields at the correct boundary. Avoid schema copies or unchecked type assertions in consumers.
- Keep public DTOs minimal, explicit and implementation-neutral; do not expose database rows or internal provider payloads. Use precise types and consistent naming across related schemas.
- Preserve compatibility within the existing API version. Coordinate intentional breaking changes through versioned contracts and update backend/frontend consumers and relevant tests together.
- Keep the package's `contract.md` and public examples synchronized with material schema changes. Test accepted, rejected and boundary payloads independently of the implementations using them.
