"""Read the intentionally small, dependency-free YAML cross-reference format.

Only the mapping/list subset used by feature-cross-ref.yaml is accepted. This
keeps the SDD tooling usable with the Python standard library on every host.
"""

from __future__ import annotations

import re
from pathlib import Path


KEYS = ("stage_ids", "spec_paths", "requirements", "code_paths", "test_paths")
FEATURE_ID = re.compile(r"[A-Z][A-Z0-9]*(?:\.[A-Z][A-Z0-9_]*)+")
STAGE_ID = re.compile(r"[A-Z]+-[0-9]{2}")
REQUIREMENT_ID = re.compile(r"[A-Z]+-R[0-9]{2}")


def load_cross_ref(path: Path) -> list[dict[str, object]]:
    """Parse and validate a fixed YAML subset: feature mappings and path lists."""
    lines = path.read_text(encoding="utf-8").splitlines()
    entries: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    active_list: str | None = None
    header = ["schema_version: 1", "features:"]
    if lines[:2] != header:
        raise ValueError(f"Invalid feature registry header: {path}")

    for line_number, line in enumerate(lines[2:], start=3):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = re.fullmatch(r"  - id: (\S+)", line)
        if match:
            current = {"id": match.group(1)}
            entries.append(current)
            active_list = None
            continue
        match = re.fullmatch(r"    ([a-z_]+): (\[\])", line)
        if match and current is not None and match.group(1) in KEYS:
            current[match.group(1)] = []
            active_list = None
            continue
        match = re.fullmatch(r"    ([a-z_]+):", line)
        if match and current is not None and match.group(1) in KEYS:
            active_list = match.group(1)
            current[active_list] = []
            continue
        match = re.fullmatch(r"      - ([A-Za-z0-9_./-]+)", line)
        if match and current is not None and active_list is not None:
            values = current[active_list]
            assert isinstance(values, list)
            values.append(match.group(1))
            continue
        raise ValueError(f"Invalid feature registry YAML at {path}:{line_number}")

    if not entries:
        raise ValueError("Feature registry is empty")
    ids: set[str] = set()
    for entry in entries:
        name = str(entry["id"])
        if not FEATURE_ID.fullmatch(name) or name in ids:
            raise ValueError(f"Invalid or duplicate feature ID: {name}")
        ids.add(name)
        if set(entry) != {"id", *KEYS}:
            raise ValueError(f"Incomplete feature cross-reference: {name}")
        for key in KEYS:
            values = entry[key]
            if not isinstance(values, list) or len(values) != len(set(values)):
                raise ValueError(f"Invalid or duplicate {key}: {name}")
        stages = entry["stage_ids"]
        requirements = entry["requirements"]
        assert isinstance(stages, list) and isinstance(requirements, list)
        if not stages or not all(STAGE_ID.fullmatch(value) for value in stages):
            raise ValueError(f"Invalid stage IDs: {name}")
        if not all(REQUIREMENT_ID.fullmatch(value) for value in requirements):
            raise ValueError(f"Invalid requirement IDs: {name}")
    return entries
