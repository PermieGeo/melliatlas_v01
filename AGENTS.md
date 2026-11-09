# MelliAtlas Engineering Guidance

These rules apply across the monorepo. A nearer `AGENTS.md` adds component-specific guidance. Keep implementation details, commands and historical regressions in their owning documentation and tests.

## Orientation and source of truth

- Start with [README](README.md) for the repository map, [ARCHITECTURE](docs/ARCHITECTURE.md) for module boundaries, and the relevant existing `contract.md` for a module's public behavior. [FEATURES](docs/FEATURES.md) and the [active specifications](docs/specs/README.md) describe product scope; [QUALITY](docs/QUALITY.md) and [TESTS](docs/TESTS.md) own verification conventions.
- Existing code, schemas and tests establish implemented behavior; active specifications establish intended behavior. Resolve discrepancies explicitly. Do not describe planned behavior as already delivered.

## Clean code and modularity

- Maximize **cohesion within modules** and minimize **coupling between them**, while keeping the architecture as simple as practical. Organize by business capability rather than global controller/service/repository folders.
- Give each significant module a narrow, understandable public API, explicit data ownership and independently testable logic. A module should be understandable without loading unrelated subsystems into the development context. Depend on published interfaces, not another module's internal files or privately owned tables; avoid dependency cycles.
- Keep presentation, application decisions, external integrations and persistence concerns separated where their responsibilities genuinely differ. Design for eventual module extraction without prematurely creating packages, microservices, factories or adapter layers.
- Use **DRY** for actual shared rules, validation, contracts and transformations. Do not abstract away harmless syntactic similarity or create a framework for one caller.
- Put genuinely reusable, domain-neutral functions in a focused `common/` or equivalent shared module. Keep business-specific helpers with the owning capability; do not turn `common/` into an unrelated collection of utilities.
- Replace **magic numbers and strings** with named constants, finite-state types or configuration when they obscure meaning or repeat a rule. Keep obvious local values and protocol-mandated literals where they are clearest.
- Prefer clear names, focused functions, composition and explicit dependencies over clever code or ceremony. Review mixed responsibilities and excessive branching; line counts alone do not mandate extraction.
- Before implementing nontrivial functionality, check existing project code and established libraries; research relevant open-source implementations when useful, including transferable ideas from other languages. Consider correctness, security, license and maintenance cost before reuse.
- Deliver one coherent, testable change at a time. Prevent **new** unnecessary coupling while working, but do not derail feature delivery with unrelated architectural cleanups. Defer accumulated debt to deliberate refactoring/review work.

## Shared TypeScript conventions

- Preserve strict TypeScript checking. Explicitly type parameters and return values at exported, public, asynchronous and other important boundaries; use inference for obvious local variables.
- Prefer precise domain types, discriminated unions and literal unions for finite states. Use `unknown` plus validation for untrusted input, not unguarded `any`, assertions or non-null assertions.
- TypeScript types disappear at runtime: validate HTTP, configuration and external data at their boundaries. The shared `packages/contracts` package owns cross-application wire schemas; do not duplicate them in clients or services.
- Keep interface definitions meaningful: introduce an interface or port for a real boundary, varying implementation or test seam, not automatically for every class.

## Documentation, comments and reliability

- Add concise **English** TSDoc/comments for important APIs, non-obvious algorithms, invariants, assumptions, security checks and lifecycle behavior. Explain _why_ or _what is guaranteed_, not each line of _how_. Avoid both undocumented critical logic and comment noise.
- Keep code, tests, module contracts and documentation consistent. When changing a module, inspect its existing `contract.md` and update it for material changes to public interfaces, ownership, dependencies or invariants. New capability modules need a concise contract; trivial private helpers do not.
- Keep each fact in its authoritative document and link to it rather than copying large descriptions. Distinguish current, experimental and planned behavior. All repository specs, plans, docs, code/config comments and test descriptions are in **English**; runtime translations may use their locale.
- Write tests for meaningful behavior and invariants, including failure, boundary and regression cases where relevant. Keep expectations independent of implementation details; never weaken valid assertions just to get a passing result.
- Preserve evidence provenance, uncertainty, private data and source-access restrictions. Do not invent live observations or present uncertain environmental conclusions as verified facts.
