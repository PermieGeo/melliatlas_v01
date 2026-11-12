# Shared HTTP Contracts

**Owner:** `packages/contracts/`. **Public API:** `src/index.ts` (including re-exports from `src/viewportCollection.ts`).

- **Consumers:** `apps/api`, `apps/web`, and `apps/admin` import the same Zod wire schemas and inferred TypeScript types.
- **Published shapes:** WGS84 coordinates, attributed weather, source catalog, provider configuration, notice geometries and review status, read-only provider-neutral territory navigation, operator-only Saturn viewport selection/progress/catalog/history, help documents, and typed API errors.
- **Guarantees:** Validation applies to JSON boundaries; coordinates use longitude/latitude with documented bounds, dates have explicit representations, and unknown evidence is not turned into a safety verdict. Pending structured polygons may be visible with an unverified label; rejected and text-only records are not public polygons.
- **Limits:** Schema validity does not approve a source, grant operator permissions, validate source licensing, or prove spatial coverage. Saturn selections require a database-registered provider region and a district listed in that region's cached directory, not arbitrary geographic boundaries.
- **Provider request configuration:** Optional bounded object-valued `parameters[regionContainer]` is merged with the separately configured `regionParameter: regionCode` when constructing an upstream request. The caller cannot override the region inside the container; this composes provider-specific district/date filters without adding provider fields to shared schemas.
- **Changes:** Update each API producer, browser consumer and contract test together. Avoid breaking `/api/v1` without explicit versioning.

No database, React, HTTP transport, secrets, or mutable provider state belongs here.
