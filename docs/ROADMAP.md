# MelliAtlas Roadmap

This is a delivery overview, not a claim of completion or an approval to implement an unselected feature. The [umbrella spec](specs/active/spec-umbrella-melliatlas.md), current [source-ingestion sub-spec](specs/active/subspecs/source-ingestion.md), and [SDD state](specs/STATE.json) govern requirements and checkpoints.

| Sequence | Stage       | Outcome                                                                                           | Current status                        |
| -------- | ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1        | `SRC-01`    | Attributed source ingestion, verifiable notice geometry, transparent map coverage and uncertainty | **Selected / partial implementation** |
| 2        | `BEE-01`    | Private apiaries with authenticated ownership and spatial proximity                               | Planned                               |
| 3        | `AGENT-01`  | Bounded source-reading LLM assistant, reviewable extraction and cited explanation                 | Planned; internal DAG scaffold only   |
| 4        | `SAT-01`    | Licensed land-cover and flowering/phenology evidence with field validation                        | Planned                               |
| 5        | `ALERT-01`  | User-controlled area monitoring, deduplicated notices and private delivery                        | Planned                               |
| 6        | `MOBILE-01` | Accessible mobile-first workflows and possible optional shell                                     | Planned                               |

## Current `SRC-01 / S3c` boundary

The legacy whole-region S3b scanner exists in source code but is not started. S3c district-cache tables and read-only status exist; **automated district refresh and 24-hour coverage claims remain gated** by provider contract and access verification.

The subsequent S3c.1 local pilot provides an explicitly enabled, bounded Saturn viewport-index fetch, persisted district directory, audited request attempts and cached field-center display. It does **not** validate polygon/ACR joins, actual treatments, provider history completeness or licensing. The next evidence milestone is independent verification of permitted provider responses, date/filter semantics and what a complete district listing really means; only then can a specified S3c.2 refresh policy be considered.

## Product directions requiring specifications

Beyond the selected scope, the design discussion includes plug-in information providers (weather, notices, satellite/phenology, historical records and community reports), multi-executor analysis and alternative **candidate migration locations/dates**, with a regional date-based hazard-sharing board. These are neither delivered features nor currently approved normative sub-specs. Before implementation, define source rights, uncertainty, privacy, safeguards, and testable acceptance criteria.

Remote administrator access requires real identity/authorization controls; a separate frontend or localhost-origin check alone is not sufficient.
