#!/usr/bin/env python3
"""Print a minimal, verified path manifest for an SDD feature ID."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("feature_id", help="Selected canonical feature ID, for example SRC-01")
    args = parser.parse_args()

    registry_path = ROOT / "docs/specs/feature-ids.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    matching = [item for item in registry["features"] if item["id"] == args.feature_id]
    if len(matching) != 1:
        parser.error(f"Feature ID not indexed: {args.feature_id}")

    feature = matching[0]
    manifest = [
        "README.md",
        "AGENTS.md",
        "docs/ARCHITECTURE.md",
        "docs/specs/STATE.json",
        feature["specPath"],
        *feature["implementedBootstrapOwners"],
        *feature["tests"],
    ]
    for name in dict.fromkeys(manifest):
        if not (ROOT / name).is_file():
            parser.error(f"Indexed path is missing: {name}")
        print(name)


if __name__ == "__main__":
    main()
