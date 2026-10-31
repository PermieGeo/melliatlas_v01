# Test Audit — 2026-10-31

This is a **source-level review**, not a certified coverage report. It uses the starter implementation and the existing test sources; test execution results must be recorded separately. The review distinguishes implemented bootstrap behavior from work that only exists in the SRC-01 specification.

## 1. What the original tests actually covered

| Layer                                               |                                            Original scenarios | Strength                                                                                             | Important limitation                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------: | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| HTTP API (`apps/api/test/app.test.ts`)              |              6 Vitest cases, including 3 invalid-query inputs | Checks attributed success, request ID, invalid coordinates, unavailable and internal-error responses | Injected service stubs; no real PostgreSQL, rate-limit or migration behavior                  |
| Weather adapter (`apps/api/test/openMeteo.test.ts`) |                                                4 Vitest cases | Checks provider decoding, timestamp and unit handling, malformed records and outage                  | No timeout, cancellation, invalid JSON, zero/maximum boundary or upstream network-throw cases |
| React app (`apps/web/src/App.test.tsx`)             |                                                 1 Vitest case | Verifies first-load map/empty message                                                                | Map component replaced with a fixture; no selection, failure, retry or catalog-state coverage |
| Playwright (`tests/e2e/map.spec.ts`)                | 1 browser journey run in desktop and mobile Chromium projects | Real Leaflet click, attributed weather link, horizontal-overflow assertion                           | API is intercepted; only successful path, no real API/database/migration evidence             |

**Original inventory:** 11 Vitest test cases and 2 browser-project runs of one Playwright scenario. Counts describe scenarios, not statement, branch or requirement coverage. The repository has **no measured line/branch coverage baseline** and no safe basis for a numeric percentage.

## 2. Quality assessment

**Positive observations**

- The weather adapter receives an injected HTTP function and clock. The input/expected-result boundary is meaningful rather than a pure implementation snapshot.
- API tests check status codes and selected structured responses, including absence of fabricated weather in error cases.
- The browser test clicks the real map and checks a user-visible result in both viewports rather than testing only component internals.

**Risks to address**

- Some assertions are too narrow: a 500 response may still leak an implementation detail unless the error body is inspected, and returning a forecast does not prove its entire wire contract or provenance.
- Original UI tests could remain green while the actual map-selection, error, retry and catalog behaviors are broken. The shallow map mock is acceptable for isolated App states, but cannot substitute for Playwright interaction.
- The API's PostGIS persistence has no integration tests. Service stubs cannot expose SQL schema drift, geospatial distance mistakes, transaction rollback or incorrect source revisions.
- No tests yet verify municipality access rules, SSRF/redirect protection, deduplication, worker restart safety, notice precision, agent citations, privacy or field calibration. Most of these capabilities **are not implemented yet**; tests must be written as their sub-spec requirements are implemented, not claimed as existing coverage.
- Playwright intercepts both public API routes, so its passing result cannot certify live Open-Meteo access, municipal ingestion or database readiness. Requiring PostgreSQL for API startup does not remove that limitation.
- No objective mutation testing, coverage thresholds, accessibility automation, load testing or contract-compatibility suite has been measured.

There is **no direct evidence** in the inspected tests that a model previously weakened assertions just to reach green. However, the small number of independently meaningful UI scenarios leaves room for that failure mode as future AI-generated code expands. The repository rules now explicitly prohibit passing a gate by changing a valid expectation.

## 3. Additional regression scenarios included in this patch

| Area               | Added cases and purpose                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| API                | Empty catalog contract, readiness failure, sanitized source-listing errors, typed 404; stronger response caching check |
| Browser API client | Coordinate/signal forwarding, invalid forecast, typed upstream error, malformed catalog, invalid error envelope        |
| React App          | Failure then explicit retry with valid attributed data; catalog failure must not look like a genuine empty catalog     |
| Playwright         | Actual map click followed by HTTP 503, visible error, explicit retry and linked recovery in both browser projects      |

These new cases test **current observable behavior**. They do not make any unimplemented notice/agent endpoint appear operational.

## 4. Remaining test backlog, ordered by risk

| Priority              | Test group                                                | Required independent oracle                                                                                                               |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 — SRC-01**       | Real PostgreSQL/PostGIS integration and migration upgrade | Stable source catalog and raw revisions across fresh/upgrade DBs; transactional recovery; known WGS84/meter-distance fixtures             |
| **P0 — SRC-01**       | Source-adapter security and idempotency                   | Approved-host policy, redirects to private addresses, caps, timeout/429; repeated downloads and worker restarts cannot publish duplicates |
| **P0 — SRC-01**       | Normalization and location accuracy                       | Village-only text never becomes exact polygon; conflicting/revised notices retain original citations; known time-zone/bbox boundaries     |
| **P0 — SRC-01**       | Actual notice API and UI contract                         | Independent route tests and full-stack Playwright flow against seeded DB; paginated filters; source link, uncertainty and review labels   |
| **P1 — bootstrap**    | Weather provider edge behavior                            | Invalid JSON/units/limits, slow/aborted requests, network exceptions, stale UI responses after switching points                           |
| **P1 — frontend**     | Extended Playwright journey matrix                        | Empty catalog, error, retry, navigation, filters, keyboard-only use, touch, a11y scan, viewport and slow-network behavior                 |
| **P1 — tooling**      | Measured coverage and contract drift                      | Instrument real unit/integration code, report statement/branch gaps, ensure API response conforms to published Zod schemas                |
| **P2 — later stages** | Privacy, AI and ecological validation                     | Cross-user API access denial and location leakage; prompt injection/citation tests; field-confirmed phenology errors                      |
| **P2 — operations**   | Bounded-load, dependency and schema gates                 | p95 latency under documented load, failure budgets and incompatible schema/migration detection                                            |

## 5. Playwright testing strategy

Maintain **two explicit suites** when the source layer exists:

1. **Browser-only interaction suite:** intercept `/api/v1` responses with named synthetic fixtures, drive the actual map and tabs, verify loading, errors, retry, accessibility, mobile layout and cancellation. Fast, deterministic and suitable for routine PR checks. This is the current suite.
2. **Full-stack acceptance suite:** run the real web and API services against an isolated PostgreSQL/PostGIS database seeded with **known synthetic notice documents**. Exercise source list -> area filter -> map feature -> original-source link, and verify database-backed behavior. Separately run approved live-source smoke tests only when permissions and environment allow; live websites must not be a required CI dependency.

Use role/label-based selectors where available; avoid fragile timing sleeps and implementation-specific selectors except where a real map interaction has no semantic alternative. Capture traces on failures. CI should run browser-only tests on each change and use a dedicated environment for database-backed flows as they are implemented.

## 6. Guard against test-to-green manipulation

1. Derive the invariant and expected result from the **normative spec or a reproducible defect** before changing implementation.
2. On failure, classify **production defect**, **test expectation contradicted by evidence**, or **environment unavailable**. Record which one and why.
3. Fix production code for a valid failing test. Change a test only when it demonstrably contradicts a requirement, and retain the original regression scenario when relevant.
4. Never skip, relax, mock away, delete, blanket-retry or increase sleeps to hide a failure. An unstable or unexecuted test means incomplete verification.
5. An LLM-written test is useful evidence, not independent acceptance. Human review checks whether the assertions would fail for a realistic broken implementation.

Routine commands and prerequisites are in [TESTS.md](TESTS.md); verification policy is in [QUALITY.md](QUALITY.md). Test and feature links are cataloged in [feature-cross-ref.yaml](specs/feature-cross-ref.yaml).
