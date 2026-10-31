#!/usr/bin/env python3
"""Validate the selected MelliAtlas SDD checkpoint and its file links."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from feature_cross_ref import load_cross_ref


ROOT = Path(__file__).resolve().parents[2]
SPEC_DIR = ROOT / "docs" / "specs"
PHASES = {
    "DESIGN",
    "READY_FOR_IMPLEMENTATION",
    "READY_FOR_REVIEW",
    "AWAITING_DEVELOPER_DECISION",
    "BLOCKED",
    "PAUSED",
    "ON_HOLD",
}


def check(condition: bool, explanation: str) -> None:
    if not condition:
        raise ValueError(explanation)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_links(path: Path) -> None:
    content = path.read_text(encoding="utf-8")
    for destination in re.findall(r"\[[^\]]+\]\(([^)]+)\)", content):
        if destination.startswith(("https://", "http://", "mailto:", "#")):
            continue
        relative = destination.split("#", 1)[0]
        if not relative:
            continue
        target = (path.parent / relative).resolve()
        check(target.is_relative_to(ROOT), f"Link escapes repository: {path} -> {destination}")
        check(target.exists(), f"Broken relative link: {path.relative_to(ROOT)} -> {destination}")


def main() -> None:
    state = load_json(SPEC_DIR / "STATE.json")
    schema = load_json(SPEC_DIR / "state.schema.json")
    check(schema["$schema"].startswith("https://json-schema.org/"), "Missing JSON schema identity")
    check(set(state) == {"schemaVersion", "mode", "selectedWorkstreamId", "workstreams"}, "Unknown/missing state properties")
    check(state["schemaVersion"] == 1, "Unexpected SDD schema version")
    check(state["mode"] == "SINGLE", "Only SINGLE mode is supported")

    streams = state["workstreams"]
    check(isinstance(streams, list) and bool(streams), "At least one workstream required")
    check(len({stream["id"] for stream in streams}) == len(streams), "Duplicate workstream IDs")
    selected = [stream for stream in streams if stream["id"] == state["selectedWorkstreamId"]]
    check(len(selected) == 1, "Exactly one workstream must match the selected ID")
    active = [stream for stream in streams if stream.get("phase") != "ON_HOLD"]
    check(len(active) == 1 and active[0] == selected[0], "SINGLE mode requires exactly one active workstream")

    for stream in streams:
        check(set(stream) == {"id", "specPath", "stageId", "phase"}, "Unknown/missing workstream property")
        check(re.fullmatch(r"[a-z][a-z0-9-]+", stream["id"]) is not None, "Invalid workstream ID")
        check(re.fullmatch(r"[A-Z]+-[0-9]{2}", stream["stageId"]) is not None, "Invalid stage ID")
        check(stream["phase"] in PHASES, "Unknown phase")
        check(stream["specPath"].startswith("docs/specs/active/subspecs/"), "Selected spec path must be active")
        spec_path = (ROOT / stream["specPath"]).resolve()
        check(spec_path.is_relative_to(SPEC_DIR) and spec_path.is_file(), "Missing or escaped child spec")
        child_text = spec_path.read_text(encoding="utf-8")
        check(re.search(r"^#{1,3}\s+" + re.escape(stream["stageId"]) + r"\b", child_text, re.MULTILINE) is not None, "Child stage header missing")

    umbrella = SPEC_DIR / "active" / "spec-umbrella-melliatlas.md"
    umbrella_text = umbrella.read_text(encoding="utf-8")
    stage_id = selected[0]["stageId"]
    check(f"current_focus: {stage_id}" in umbrella_text, "Umbrella focus disagrees with checkpoint")

    child = ROOT / selected[0]["specPath"]
    child_content = child.read_text(encoding="utf-8")
    plan_matches = re.findall(r"^implementation_plan:\s*(\S+\.md)\s*$", child_content, re.MULTILINE)
    check(len(plan_matches) == 1, "Selected child must link one implementation plan")
    plan = (child.parent / plan_matches[0]).resolve()
    check(plan.is_file(), "Selected implementation plan is missing")
    check(plan.parent == child.parent, "Implementation plan must be beside its sub-specification")
    check(f"selected_stage: {stage_id}" in plan.read_text(encoding="utf-8"), "Plan stage mismatch")
    check(child.name in plan.read_text(encoding="utf-8"), "Implementation plan must link back to its spec")

    catalog = (ROOT / "docs" / "FEATURES.md").read_text(encoding="utf-8")
    features = load_cross_ref(SPEC_DIR / "feature-cross-ref.yaml")
    for feature in features:
        name = str(feature["id"])
        check(f"`{name}`" in catalog, f"Feature missing from FEATURES.md: {name}")
        specs, stages = feature["spec_paths"], feature["stage_ids"]
        reqs, owners, tests = feature["requirements"], feature["code_paths"], feature["test_paths"]
        check(all(isinstance(v, list) for v in (specs, stages, reqs, owners, tests)),
              f"Invalid feature lists: {name}")
        check(bool(specs), f"Feature lacks spec references: {name}")
        for path in [*specs, *owners, *tests]:
            resolved = (ROOT / path).resolve()
            check(resolved.is_relative_to(ROOT) and resolved.is_file(), f"Missing feature path: {name} / {path}")
        spec_text = "\n".join((ROOT / path).read_text(encoding="utf-8") for path in specs)
        for req in reqs:
            check(re.search(r"\b" + re.escape(req) + r"\b", spec_text) is not None,
                  f"Requirement not found for feature: {name} / {req}")
        for path in owners:
            marker = re.search(r"^// Feature IDs: (.+)$", (ROOT / path).read_text(encoding="utf-8"), re.MULTILINE)
            check(marker is not None and name in marker.group(1).split(", "),
                  f"Missing owner feature marker: {name} / {path}")
        for stage in stages:
            check(stage in umbrella_text, f"Feature stage missing from umbrella: {name} / {stage}")

    for document in SPEC_DIR.rglob("*.md"):
        validate_links(document)
    print(f"SDD state and links valid: {stage_id} ({selected[0]['phase']})")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(f"SDD validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
