# Saturn Provider Contract

**Owner:** `apps/api/src/modules/sources/providers/saturn/`. **Public composition boundary:** `index.ts`.

- Exports `SaturnViewportCollectionService`, local `createSaturnViewportClientRouter`, `createSaturnViewportOperatorRouter` and `ViewportCollectionActions`. The adapter `SaturnProvider` implements the parent module's `ViewportIndexProvider`/`DistrictDirectoryProvider` ports.
- The service exposes exact-filter `status` (database only) and explicit `fetchNext` (at most one bounded `/query` page). An explicit directory refresh fetches `/district/55`; both use the registered restricted-HTTPS profile, persistent source-wide request throttle and sanitized audit.
- Inputs require a server-recognized district ID, bounded WGS84 viewport and bounded `UpdateMap` interval. District catalog entries are named **centers**, not administrative polygons; the previously verified Yartsevo ID remains a fallback. Published JSON wire contracts live in `@melliatlas/contracts`.
- Stored immutable page receipts and feature/plan IDs represent a **viewport map index**, not field polygons, observed pesticide treatments, verified dates, district coverage or risk. Offline polygon/ACR ID comparison is investigatory only and does not authorize joins or publication.
- Live access is disabled by default; explicit fetch requires reviewed source access and server enablement. Cached reads and invalid requests never contact Saturn. Loopback/origin restrictions are not production authentication.
- Other modules use `index.ts` rather than internal parsers/repos. The existing legacy treatment-feed parser remains in the parent source module. Shared geographic schema constants in `sourceProfile.ts` are currently reused by that parser; changes must preserve both validation contracts.

Feature trace: `SOURCES.DOCUMENT_HISTORY` and `SRC-R33`–`SRC-R35`. Internal protocol research belongs in [Implementation](../../../../../../../docs/IMPLEMENTATION.md), not in this cross-module contract.
