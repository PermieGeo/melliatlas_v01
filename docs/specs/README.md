# MelliAtlas Specifications

MelliAtlas uses a **human-readable umbrella -> selected normative sub-spec -> detailed advisory implementation plan** workflow. One developer-selected stage is active at a time. Product requirements are not declared accepted by the generation of code, documents, tests or release packages.

## Selected work

| Role            | File                                                                                   | State                                                  |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Umbrella        | [MelliAtlas MVP](active/spec-melliatlas-mvp.md)                                        | Draft; current focus `SRC-01`                          |
| Normative child | [Source ingestion and evidence](active/subspecs/source-ingestion.md)                   | Selected; `SRC-01`                                     |
| Advisory plan   | [Source ingestion implementation plan](active/source-ingestion-implementation-plan.md) | Baseline proposed steps; refresh before implementation |
| Checkpoint      | [STATE.json](STATE.json) and [schema](state.schema.json)                               | `READY_FOR_IMPLEMENTATION`                             |
| Feature mapping | [feature-ids.json](feature-ids.json)                                                   | Implemented bootstrap symbols only                     |

## Workflow

1. Review the [architecture](../ARCHITECTURE.md), [roadmap](../ROADMAP.md), selected sub-spec, active plan and verified code.
2. Reconcile the selected plan against the actual current repository and incoming source evidence.
3. Execute testable batches; record migration, provider failure, browser and restart evidence.
4. Request developer acceptance of the complete selected scope.
5. After approval, move the normative child **and** its plan together to [`archive/subspecs/`](archive/README.md), update indexes/checkpoint, then select the next scope.

Run `python3 tools/specs/validate_state.py` for structure, state, links and selected-stage consistency. This validator does **not** verify live provider access, scientific validity or developer acceptance.
