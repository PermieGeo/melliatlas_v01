# SDD Rules

Extends [root AGENTS.md](../../AGENTS.md).

- Normative umbrella: [spec-umbrella-melliatlas.md](active/spec-umbrella-melliatlas.md). Selected child: `active/subspecs/<name>.md`; advisory plan: `active/subspecs/<name>-implementation-plan.md`. The child and plan MUST link each other.
- `STATE.json` is the developer-controlled processing checkpoint. In `SINGLE` mode, exactly one workstream may be active. The selected child stage and umbrella `current_focus` MUST match.
- Allowed phases: `DESIGN`, `READY_FOR_IMPLEMENTATION`, `READY_FOR_REVIEW`, `AWAITING_DEVELOPER_DECISION`, `BLOCKED`, `PAUSED`, `ON_HOLD`.
- Write specifications in English only. The umbrella MUST use readable, detailed human prose, concrete journeys, clear current/planned distinctions and short paragraphs. Sub-specs MUST remain concise normative contracts with observable outcomes and failure/boundary evidence. Avoid filler.
- State source permissions, endpoints, third-party claims and scientific accuracy as verified or provisional. Never invent access or real observations.
- A plan MUST distinguish verified existing files from proposed files. Give ordered bounded implementation steps, migrations/retry/restart paths, deterministic tests and completion gates.
- Draft future sub-specs only when selected; refresh the selected plan against actual sources before implementation.
- Feature IDs are stable semantic `DOMAIN.CAPABILITY` names in [FEATURES](../FEATURES.md). Stage IDs (`SRC-01`) identify delivery workstreams; requirement IDs (`SRC-R01`) and test scenarios (`SRC-T01`) belong to sub-specs. A feature MAY span many stages/specs/requirements. Never derive feature names from spec numbering.
- Maintain [feature-cross-ref.yaml](feature-cross-ref.yaml): feature -> stages, specs, requirements, actual code and tests. Leave planned code/test arrays empty; indexed production owners MUST carry `// Feature IDs: ...` markers and follow module `contract.md`.
- Archive the complete child/plan pair under `archive/subspecs/` only after explicit developer acceptance. Keep stage metadata and links coherent.
- Run `python3 tools/specs/validate_state.py` after any SDD change; report actual results, never infer acceptance.
