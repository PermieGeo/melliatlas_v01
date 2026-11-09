# MelliAtlas Specifications

MelliAtlas uses one umbrella specification, one selected normative sub-specification and a separate advisory implementation plan **beside that sub-specification**. Developer acceptance controls lifecycle changes.

## Current scope

| Role                 | Document                                                                                 | State                                                           |
| -------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Umbrella             | [MelliAtlas MVP](active/spec-umbrella-melliatlas.md)                                     | Draft; current focus `SRC-01`                                   |
| Selected sub-spec    | [Source ingestion and evidence](active/subspecs/source-ingestion.md)                     | `SRC-01`                                                        |
| Advisory plan        | [Current source-ingestion plan](active/subspecs/source-ingestion-implementation-plan.md) | S3c.1 research and developer architecture decisions pending     |
| Checkpoint           | [STATE.json](STATE.json) and [schema](state.schema.json)                                 | `READY_FOR_IMPLEMENTATION`                                      |
| Feature traceability | [feature-cross-ref.yaml](feature-cross-ref.yaml)                                         | Stable capabilities, stages, requirements, code and test owners |

## Lifecycle

1. Inspect the selected sub-spec, its same-directory plan, owning module contracts and actual code.
2. Refresh the plan, then implement bounded steps with independent tests and source evidence.
3. Request developer review and acceptance. Passing tests, ZIP generation or a merged PR alone does not accept a stage.
4. After explicit acceptance, move **both** the child and its plan to [archive/subspecs](archive/README.md) and update the checkpoint/index/umbrella together.
5. Create the next sub-spec and matching plan only when that scope is selected.

The [historical SRC-01 implementation record](active/subspecs/source-ingestion-implementation-history.md) preserves superseded increments and their earlier rationale. It is not an active implementation plan; new work follows the linked current plan and developer-approved requirements.

Run `python3 tools/specs/validate_state.py` to check checkpoint, cross-references and relative links. The validator does not certify live sources, scientific accuracy or acceptance. Durable capabilities live in [FEATURES](../FEATURES.md); stage IDs (`SRC-01`), requirements (`SRC-R01`) and test scenarios (`SRC-T01`) are distinct.
