# Source Evidence Module Contract

**Owner:** `apps/api/src/modules/sources/`. **Provider submodule:** [Saturn](providers/saturn/contract.md).

- **Application boundary:** `TreatmentIngestionService` and source configuration/review repositories support explicit, bounded operator ingestion, immutable evidence and review decisions. Public notice projection reads stored PostGIS observations by map bounds.
- **Shared ports:** `providerPorts.ts` defines `ViewportIndexProvider` and `DistrictDirectoryProvider`; `auditedSourceRequest.ts` coordinates source-wide request audit and throttle reservation. The generic `RestrictedSourceFetcher` enforces destination, TLS/DNS, redirect, MIME, size and time policy.
- **Published data:** source catalog, configured connection revisions, evidence documents, observation status and precision, read-only district coverage, and source-attributed map polygons. Valid structured pending polygons can be public **only with explicit unverified status**; rejected, text-only and model-pending records remain internal.
- **Isolation:** source-specific HTTP request shapes and their interpretation belong to adapters. Existing regional cursor/scan code is **not wired into server startup**; its persisted state is not proof of refreshed district coverage.
- **Non-claims:** a downloaded page, cached center, provider date field or complete viewport index is not an independently verified treatment, legal reuse right, hazard verdict or district-wide coverage.

Add a provider through its own validated adapter and documented access decision. Do not bypass server-side restricted retrieval or introduce background polling from UI reads. See [Implementation](../../../../../docs/IMPLEMENTATION.md) for internal workflows.
