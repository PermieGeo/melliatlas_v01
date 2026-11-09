# Specification Authoring Guidance

Extends [root engineering guidance](../../AGENTS.md). [Specification index](README.md) owns the current structure and lifecycle.

- Write **normative specifications** as observable behavior: purpose, actors and journeys, scope/non-goals, requirements, failure/boundary cases and verifiable acceptance evidence. Avoid implementation recipes disguised as requirements.
- Maintain a separate, linked **advisory implementation plan** for each new or materially changed sub-spec. Plans identify verified existing owners versus proposed files, ordered steps, dependencies, compatibility/migrations, recovery and independent tests. Keep plans useful, not ceremonially exhaustive.
- The umbrella describes the product and distinguishes **implemented, experimental and planned** capabilities. A selected sub-spec remains focused on its current workstream; avoid unrelated future detail.
- Keep feature identifiers, stage identifiers, requirement identifiers and test scenarios distinct. Preserve existing IDs and update [feature cross-references](feature-cross-ref.yaml) only when ownership or coverage actually changes.
- Link to authoritative architecture, contracts, tests and evidence rather than duplicating long code descriptions or historical implementation logs. Confirm that cited file paths, endpoints and behaviors exist.
- Label third-party access permissions, API semantics, geographic/scientific claims and untested assumptions as verified or provisional. Never substitute a generated example for field evidence.
- `STATE.json` tracks developer-selected work and acceptance; passing tests or completing a document does not itself advance that state. Keep the current spec, linked plan and index internally consistent.
- All specifications and plans are in English, with clear prose and concise, independently testable requirements.
