# MelliAtlas SDD Rules for Agents

Extends [root AGENTS.md](../../AGENTS.md) and applies to the entire `docs/specs/` tree.

## Source of truth

- The [umbrella specification](active/spec-melliatlas-mvp.md) is the normative product direction. A selected child specification governs its bounded scope; a linked implementation plan is **advisory** and must be checked against actual source at the start of work.
- `STATE.json` is a committed developer-controlled **processing checkpoint**, not evidence of tests, Git status, acceptance or deployment. Its `current` selected workstream must agree with the umbrella's `current_focus`.
- `mode: SINGLE` permits exactly one workstream with a phase other than `ON_HOLD`. Permitted phases: `DESIGN`, `READY_FOR_IMPLEMENTATION`, `READY_FOR_REVIEW`, `AWAITING_DEVELOPER_DECISION`, `BLOCKED`, `PAUSED`, `ON_HOLD`.

## File lifecycle

1. Store the umbrella at `active/spec-melliatlas-mvp.md`, the selected child at `active/subspecs/<area>.md`, and its single separately linked plan directly under `active/<area>-implementation-plan.md`.
2. Draft the next child **just in time**; do not generate unused future sub-specs or plans. When resuming, regenerate the chosen implementation plan against current files, tests and provider contracts.
3. Include feature IDs, ownership, testable requirements, positive/negative/boundary cases, privacy, source provenance, failure paths, migrations and explicit acceptance gates.
4. Mark all third-party endpoints, scientific claims, regulatory assumptions and access rights as **verified** or **provisional**; source-document claims are not evidence of valid API access or accurate environmental inference.
5. Link each normative child to exactly one implementation plan and the plan back to its child. Keep links, feature IDs and `STATE.json` consistent.
6. Archive the **complete child-and-plan pair** in `archive/subspecs/` only after explicit developer acceptance of all its requirements. Do not infer acceptance from a green CI run, compiled app, created ZIP or merged PR.

## Incremental work

- Group related changes into small, usable vertical slices with clear API/DB/UI contracts and independent tests.
- Implement only the selected child scope unless the developer explicitly approves widening it.
- Preserve previously collected source evidence and review decisions across retries/restarts. Never promote a partially parsed document as a verified treatment notice.
- Run `python3 tools/specs/validate_state.py` and project checks after every SDD metadata edit. Clearly report checks not executed.
