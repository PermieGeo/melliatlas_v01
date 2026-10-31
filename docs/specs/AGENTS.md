# SDD Rules

Extends [root AGENTS.md](../../AGENTS.md).

- Normative umbrella: [spec-umbrella-melliatlas.md](active/spec-umbrella-melliatlas.md). Selected child: `active/subspecs/<name>.md`; advisory plan: `active/subspecs/<name>-implementation-plan.md`. The child and plan MUST link each other.
- `STATE.json` is the developer-controlled processing checkpoint. In `SINGLE` mode, exactly one workstream may be active. The selected child stage and umbrella `current_focus` MUST match.
- Allowed phases: `DESIGN`, `READY_FOR_IMPLEMENTATION`, `READY_FOR_REVIEW`, `AWAITING_DEVELOPER_DECISION`, `BLOCKED`, `PAUSED`, `ON_HOLD`.
- Write specifications in **English only**. Each requirement MUST state an observable outcome and failure/boundary behavior; include IDs, owner, dependencies and acceptance evidence where relevant.
- State source permissions, endpoints, third-party claims and scientific accuracy as verified or provisional. Never invent access or real observations.
- A plan MUST distinguish verified existing files from proposed files. Give ordered bounded implementation steps, migrations/retry/restart paths, deterministic tests and completion gates.
- Draft future sub-specs only when selected; refresh the selected plan against actual sources before implementation.
- Link stable capability IDs from [FEATURES](../FEATURES.md), module ownership from `contract.md`, and implementation markers from `feature-ids.json`. Do not confuse feature IDs with stage IDs or acceptance.
- Archive the complete child/plan pair under `archive/subspecs/` only after explicit developer acceptance. Keep stage metadata and links coherent.
- Run `python3 tools/specs/validate_state.py` after any SDD change; report actual results, never infer acceptance.
