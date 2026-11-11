# Core Orchestration Scaffold Contract

**Owner:** `apps/api/src/modules/core/`. **Public API:** `index.ts`.

- `createCore({ weather, saturn })` exposes `inspectWeather(point)` and a typed `InformationProviderRegistry`; it adapts Open-Meteo inspection and **read-only** persisted Saturn viewport status.
- `AnalysisGraph` executes trusted, code-defined DAG nodes sequentially. Supported labels (`provider`, `algorithm`, `statistics`, `ml`, `llm`) classify workers; they do not imply an installed ML model or LLM integration.
- Both registry and graph validate contracts and reject malformed data/invalid dependencies. Registration by untrusted users or source content is forbidden.
- Provider-specific access, credentials, auditing, throttling and storage stay with `weather/` and `sources/`. Core has no public HTTP route, durable graph runs, scheduler, autonomous fetching, or migration recommendations.

New executors require explicit typed inputs/outputs, permission and resource budgets, provenance rules, and independent tests.
