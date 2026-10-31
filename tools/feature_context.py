#!/usr/bin/env python3
"""Print a minimal, verified path manifest for an SDD feature ID."""

from __future__ import annotations

import argparse
from pathlib import Path

from specs.feature_cross_ref import load_cross_ref


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("feature_id", help="Stable feature ID (WEATHER.POINT_FORECAST) or stage ID (SRC-01)")
    args = parser.parse_args()

    registry_path = ROOT / "docs/specs/feature-cross-ref.yaml"
    features = load_cross_ref(registry_path)
    matching = [
        item for item in features
        if item["id"] == args.feature_id or args.feature_id in item["stage_ids"]
    ]
    if not matching:
        parser.error(f"Unknown feature/stage ID: {args.feature_id}")

    manifest = [
        "README.md",
        "AGENTS.md",
        "docs/FEATURES.md",
        "docs/ARCHITECTURE.md",
        "docs/specs/STATE.json",
        "docs/specs/feature-cross-ref.yaml",
    ]
    for feature in matching:
        manifest.extend(feature["spec_paths"])
        manifest.extend(feature["code_paths"])
        manifest.extend(feature["test_paths"])
    for name in dict.fromkeys(manifest):
        if not (ROOT / name).is_file():
            parser.error(f"Indexed path is missing: {name}")
        print(name)


if __name__ == "__main__":
    main()
