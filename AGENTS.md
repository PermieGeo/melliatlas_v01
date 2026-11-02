# MelliAtlas Repository Rules

Applies to the monorepo. Nearest nested `AGENTS.md` files extend these rules and cannot weaken them.

## Source of truth

1. Current code, Zod schemas, migrations and executable tests define existing behavior.
2. [Architecture](docs/ARCHITECTURE.md) and module `contract.md` files define boundaries and ownership.
3. [Active specifications](docs/specs/README.md) define intended behavior. Implementation plans are advisory.
4. [STATE.json](docs/specs/STATE.json) is a developer-controlled selection checkpoint, not acceptance evidence.

Before changes, read the owning module's `contract.md`, nearest `AGENTS.md`, selected spec/plan and relevant tests. Read a collaborating module's contract before inspecting its internals.

## Module boundaries and DRY

- Organize by cohesive **capability**, not global controller/service/repository layers. Each functional module owns its behavior, adapters, persistence access, tests and published API.
- Every functional module MUST have a concise `contract.md` in its root: purpose, public entry points, owned data, allowed dependencies, forbidden access, invariants and extension points. Link to source; do not duplicate signatures.
- Keep modules acyclic. Call another module through its documented public entry point; never import another module's private adapter or access its privately owned tables.
- `apps/api/src/app.ts` and `server.ts` compose the backend and HTTP routes; `apps/web/src/App.tsx` and `apps/admin/src/App.tsx` compose separate client/operator UIs. Keep business rules outside composition roots.
- `apps/web` and `apps/admin` talk to `apps/api` only via `/api/v1`. Operator routes and pending previews must never be imported or called from `apps/web`. `packages/contracts` owns public Zod wire schemas and imports neither application.
- Apply **DRY to behavior and contracts**: one owner for each rule/schema/normalizer. Extract shared logic only after genuine reuse; never create a generic framework for one caller. Keep domain-specific helpers in the owning module.
- Add a new public API, dependency, data owner or module only with an explicit requirement and updated `contract.md`; avoid speculative microservices.

## File growth and maintainability

- Keep each hand-written source file cohesive and easy to review. Aim for at most **300 physical lines** (including comments and blank lines). Crossing that threshold MUST trigger an explicit responsibility and extraction review before adding another feature; it is not a mandate for arbitrary splitting.
- New production files above **400 lines** require a documented, specific exception. Do not add new features to existing files above 400 lines without first extracting a cohesive responsibility. A localized defect fix may remain in place if it introduces no new responsibility; explain that exception in the handoff.
- Split by capability and ownership, not line count alone: React components, hooks and feature state; backend use cases, provider adapters and persistence; shared HTTP schemas in `packages/contracts`. Keep composition roots (`App.tsx`, `app.ts`, `server.ts`) limited to orchestration and wiring.
- Do not create generic `utils` dumping grounds, one-function wrapper files, extra public APIs or duplicate state just to reduce file length. Preserve acyclic dependencies, contracts and independently testable behavior.
- Review growing test files by scenario or use case; split suites where it improves navigation without removing regression coverage. Apply the same cohesion rule to documentation: keep a canonical owner and link instead of repeating long content.
- Before a repository-changing handoff, check the line counts of created or edited hand-written source files. Report threshold crossings, any justified exception and the relevant extraction decision. Pre-existing oversized files are technical debt to reduce when their owning feature is changed, not a reason for unrelated bulk refactoring.

## User-facing text and localization

- All application-authored text visible to beekeepers or operators MUST be localizable. This includes navigation, buttons, headings, field labels and placeholders, help text, map popups and legends, accessibility labels, loading/empty/error states, validation feedback, and email/push notification templates. Do not hardcode such strings in UI components, templates or server-generated user messages.
- Use semantic translation keys in locale catalogs with named parameters. Do not build translated sentences by concatenating fragments, interpolating untranslated prose, or branching on a specific language. Use the localization mechanism for plurals and grammatical variants.
- Add translations for each new or changed key in all currently supported locale catalogs, with a documented fallback for missing keys. Cover essential UI messages, interpolation and plural cases in tests; do not claim unsupported languages have been translated.
- Format dates, times, numbers and measurement units with locale-aware facilities such as `Intl`. Do not hardcode `ru-RU` or assume the display language from the selected country, map region, data source or user location. A language preference is separate from geographic coverage.
- Keep HTTP/API error codes and notification events language-neutral and structured; localize user-facing explanations at the presentation or delivery boundary using the recipient's language preference. Do not persist only pre-rendered, single-language notification text.
- Keep source-provided quotations, names and evidence attributable and unchanged; these are data, not application-authored UI copy. Product names, stable identifiers, URLs and protocol values do not require translation. Retrieve country/region labels from the geographic data model rather than embedding country-specific UI strings.
- Existing hardcoded UI copy is migration debt. When changing an owning feature, migrate the affected text without unrelated mass refactoring. Code comments, test descriptions and software documentation remain in English; translated runtime catalog values may use their respective languages.

## TypeScript contracts, documentation and function size

- Keep `strict: true` in **every** TypeScript project. It already includes `noImplicitAny` and `strictNullChecks`; do not duplicate flags without an explicit reason. Enable `noUnusedLocals` and `noUnusedParameters` where verified typechecks support them. Treat `exactOptionalPropertyTypes` as an incremental, typechecked migration: distinguish omitted properties from properties explicitly set to `undefined`, and do not flip the flag for an unverified workspace.
- Explicitly annotate function **parameters and return types** on exported functions, public methods, service/API boundaries, async operations (`Promise<T>`), callbacks whose types would otherwise be unclear, and any complex or ambiguous inference. Prefer `unknown` plus boundary validation to `any`; avoid redundant variable annotations where inference is unambiguous. Preserve optionality and nullability accurately, and do not use non-null assertions to silence valid errors.
- Use **literal unions** (or an owning Zod enum/inferred union) for finite states, actions and variants instead of broad `string` types. Use **template literal types** for real, testable identifier/string patterns; do not represent unchecked runtime input as validated merely by a type assertion. Keep domain and HTTP contracts owned by their existing modules.
- Add concise **English TSDoc/JSDoc** to important exported APIs, non-obvious algorithms, security boundaries and complex lifecycle operations. Explain purpose, invariants and relevant `@param` / `@returns` / `@throws` tags. Document throws only when a function actually propagates or creates a meaningful failure. Avoid comments that merely repeat TypeScript signatures, and update annotations alongside behavior.
- All **source-code and configuration comments, docstrings, test descriptions and software documentation must be in English**. Developer-authored **error identifiers, diagnostic messages and server logs must be in English** and must not leak secrets or raw provider records. User-visible errors are different: use language-neutral API error codes and localized presentation catalogs (see localization rules); never expose a raw English backend diagnostic instead of a translated explanation in the UI. Original source-provided quotations remain attributed data.
- Prevent **function growth** as well as file growth. Review functions that mix validation, persistence, transport, state transitions and presentation; extract focused helpers, hooks or module methods before adding another responsibility. As a review heuristic, inspect functions longer than **40 physical lines** or with deeply nested branching; these are not automatic build failures. Keep cohesive transactions and domain invariants intact; avoid wrapper-only or speculative abstractions.
- Apply the existing **300/400-line file guardrails** during every touched feature. For oversized legacy files, extract a genuine responsibility before extending behavior; for narrow defect fixes, document why extraction is not justified. Tests should assert semantics rather than private helper structure.

## Implementation discipline

- Make the smallest coherent change. Do not refactor unrelated areas or introduce unverified dependencies.
- Keep code comments, configuration comments, tests' descriptions, specifications and **all software documentation strictly in English**. User-facing UI copy may be localized.
- Validate inputs and external data at boundaries; translate failures to typed, non-leaking responses. Do not expose persistence records over HTTP.
- Preserve source URL, timestamps, provenance, uncertainty, revision and human-review state. Never present synthetic observations as real evidence.
- Protect private apiary coordinates, credentials and raw private source data. Untrusted pages and LLM output never grant network, SQL or execution privileges.
- Keep migrations additive and immutable after application. Bounded retries, idempotency and restart behavior require tests.
- Derive positive, negative, boundary and regression assertions independently from the spec or a reproduced defect. On failure classify product defect, invalid expectation or unavailable environment; fix code when a valid assertion fails. MUST NOT weaken, skip, delete, mock away or silently retry tests merely for PASS. Justify test changes with spec evidence and preserve regression purpose.
- Keep tests deterministic: local provider stubs, controlled clocks, no public network or production credentials. Verify persistence against real PostGIS and user journeys with Playwright desktop/mobile. Stubbed browser tests do not prove full-stack behavior. Unresolved/flaky tests leave verification incomplete.
- Stable semantic Feature IDs (`DOMAIN.CAPABILITY`) belong to [FEATURES](docs/FEATURES.md) and [feature-cross-ref.yaml](docs/specs/feature-cross-ref.yaml), separate from stages and numbered requirements.
- Run focused tests, then the relevant checks from [TESTS.md](docs/TESTS.md). Formatting is a separate step; check commands must not edit files.
- Do not change acceptance/archive state without explicit developer approval; never imply Git/PR/deployment operations were performed.

## Documentation ownership

| Concern                          | Canonical document                       |
| -------------------------------- | ---------------------------------------- |
| Repository overview              | [README.md](README.md)                   |
| Developer workflow               | [INSTRUCTIONS](docs/INSTRUCTIONS.md)     |
| Local setup and platforms        | [INSTALLATION](docs/INSTALLATION.md)     |
| App use and API examples         | [USAGE](docs/USAGE.md)                   |
| Implemented and planned features | [FEATURES](docs/FEATURES.md)             |
| Architecture and module graph    | [ARCHITECTURE](docs/ARCHITECTURE.md)     |
| Current wiring                   | [IMPLEMENTATION](docs/IMPLEMENTATION.md) |
| Environment variables            | [CONFIGURATION](docs/CONFIGURATION.md)   |
| Tests and commands               | [TESTS](docs/TESTS.md)                   |
| Quality policy                   | [QUALITY](docs/QUALITY.md)               |
| Troubleshooting                  | [DIAGNOSTIC](docs/DIAGNOSTIC.md)         |
| Priorities                       | [ROADMAP](docs/ROADMAP.md)               |
| SDD structure and checkpoint     | [specs/README](docs/specs/README.md)     |
| Module boundary                  | Nearest `contract.md`                    |

Keep information in its owning document; link instead of copying long sections.

## SDD

- Umbrella: `docs/specs/active/spec-umbrella-melliatlas.md`.
- Selected normative child: `docs/specs/active/subspecs/source-ingestion.md`.
- Linked advisory plan: `docs/specs/active/subspecs/source-ingestion-implementation-plan.md`.
- One selected workstream: `docs/specs/STATE.json`. Refresh the plan against current sources before implementation.
- Archive a completed child **with its plan** only after developer acceptance.
- See [specification rules](docs/specs/AGENTS.md).
