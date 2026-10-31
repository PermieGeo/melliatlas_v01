# MelliAtlas Specifications

MelliAtlas uses one umbrella specification, one selected normative sub-specification and a separate advisory implementation plan **beside that sub-specification**. Developer acceptance controls lifecycle changes.

## Current scope

| Role                        | Document                                                                                        | State                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Umbrella                    | [MelliAtlas MVP](active/spec-umbrella-melliatlas.md)                                            | Draft; current focus `SRC-01`                  |
| Selected sub-spec           | [Source ingestion and evidence](active/subspecs/source-ingestion.md)                            | `SRC-01`                                       |
| Advisory plan               | [Source ingestion implementation plan](active/subspecs/source-ingestion-implementation-plan.md) | Refresh against actual source before execution |
| Checkpoint                  | [STATE.json](STATE.json) and [schema](state.schema.json)                                        | `READY_FOR_IMPLEMENTATION`                     |
| Implemented ownership index | [feature-ids.json](feature-ids.json)                                                            | Bootstrap `SRC-01` owners/tests only           |

## Lifecycle

1. Inspect the selected sub-spec, its same-directory plan, owning module contracts and actual code.
2. Refresh the plan, then implement bounded steps with independent tests and source evidence.
3. Request developer review and acceptance. Passing tests, ZIP generation or a merged PR alone does not accept a stage.
4. After explicit acceptance, move **both** the child and its plan to [archive/subspecs](archive/README.md) and update the checkpoint/index/umbrella together.
5. Create the next sub-spec and matching plan only when that scope is selected.

Run `python3 tools/specs/validate_state.py` to check checkpoint consistency and relative links. The validator does not certify live sources, scientific accuracy or acceptance. Stable capability IDs are listed in [FEATURES](../FEATURES.md); spec-specific requirements and test scenarios remain inside each sub-spec.
