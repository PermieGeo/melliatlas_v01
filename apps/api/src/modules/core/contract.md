# Core Orchestration Scaffold Contract

**Owner:** `apps/api/src/modules/core/`. **Status:** minimal, internal-only scaffold outside the selected `SRC-01` stage.

## Responsibilities

- `InformationProviderRegistry` registers trusted, code-defined provider adapters, exposes their names/capabilities, and validates input and output through their existing Zod schemas.
- `createCoreProviderRegistry` adapts the existing Open-Meteo point forecast and Saturn's **stored viewport-index status**. It does not initiate Saturn collection or grant source access.
- `createCore` routes the existing weather inspection use case through the provider registry. Saturn's existing local operator/client routes still call their original service and preserve all policy, rate limiting and audit behavior.
- `AnalysisGraph` executes a small, code-defined directed acyclic graph sequentially. Nodes are labeled by worker kind (`provider`, `algorithm`, `statistics`, `ml`, `llm`) and receive only the results of their declared dependencies.

## Invariants and boundaries

- Provider IDs and capabilities are metadata, not authorization. Only server-owned code may register a provider or a graph node; no external request, LLM response, or database record can inject executable nodes.
- Weather responses retain their source attribution and forecast-model nature. Saturn cached centers remain unverified map-index evidence, **not treatment events, treatment polygons, area coverage or safety assessments**.
- Provider readers validate both inputs and outputs. An invalid source result is rejected without replacement by invented values.
- A graph rejects duplicate/missing/cyclic dependencies before execution and stops after a failed node. There are no background requests, retries, persistence, parallel execution, resource budgets or automatic LLM calls.
- Source-specific transport, terms, credentials, geographic restrictions and persistent evidence remain under `weather/` and `sources/`. The core owns no tables or public HTTP endpoints.

## Extension

Register a new source through a narrowly defined provider adapter using the source's own validated schema and existing access boundary. Add real algorithms/LLM executors as trusted graph nodes only when their input/output, tool permissions, timeouts, evidence provenance and scientific limitations are specified and tested. A production decision pipeline will require durable state and human-review rules; the scaffold does not implement beekeeper migration recommendations.
