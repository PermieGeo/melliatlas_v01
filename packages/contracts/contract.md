# Shared HTTP Contract Module

**Owner:** `packages/contracts/`. **Status:** implemented `/api/v1` schema foundation.

- **Responsibility:** Publish strict serializable Zod schemas and inferred TypeScript types consumed by API and browser.
- **Public entry point:** [src/index.ts](src/index.ts): coordinates/location query, weather/provenance, source catalog, Provider operator configuration and typed API errors.
- **Owned data:** Public schema definitions only; no database or runtime state.
- **Allowed dependencies:** Zod and TypeScript only.
- **Forbidden:** React/Express, Node-specific APIs, database access, provider-specific request libraries or mutable application services.
- **Invariants:** Coordinates use WGS84 degrees; timestamps are ISO date-time strings; optional source-success time is explicit nullable; provider output must be mapped to public schema before returning.
- **Provider configuration:** `saturnConfigurationSchema`, `saturnConfigurationEditSchema` and `saturnRequestSettingsSchema` validate method, flat bounded parameters, region code and optimistic revision. Endpoint destination safety is additionally checked on the backend; this schema does not grant fetching permission.
- **Extension:** Update schema, backend, web consumer and independent tests together. Preserve existing `/api/v1` compatibility or introduce deliberate versioning.
