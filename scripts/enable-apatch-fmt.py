#!/usr/bin/env python3
"""Safely enable the repository formatting and check runners in local apatch configuration."""

from pathlib import Path
import re
import sys

CONFIG_PATH = Path(__file__).resolve().parents[1] / ".apatch" / "config.yaml"
FORMAT_BLOCK = 'format_commands:\n  - ["sh", "./run-format.sh"]\n'
CHECKS_BLOCK = 'checks:\n  - ["sh", "./run-tests.sh"]\n'


def find_top_level_block(content: str, name: str) -> str | None:
    matches = list(re.finditer(rf"(?m)^{re.escape(name)}\s*:(?=[ \t]|$)[^\n]*", content))
    if not matches:
        return None
    if len(matches) > 1:
        raise ValueError(f"Duplicate top-level {name} keys in apatch configuration")
    match = matches[0]
    next_key = re.search(r"(?m)^[^\s#][^\n]*", content[match.end():])
    end = match.end() + next_key.start() if next_key else len(content)
    return content[match.start():end]


def configure(config: Path) -> bool:
    if config.is_symlink() or config.parent.is_symlink():
        raise ValueError("Refusing to modify a symbolic-link configuration path")
    if config.exists() and not config.is_file():
        raise ValueError("apatch configuration path is not a regular file")
    original = config.read_text(encoding="utf-8") if config.exists() else "schema_version: 1\n"

    existing_format = find_top_level_block(original, "format_commands")
    expected_command = r"(?m)^\s*-\s*\[\s*[\"']sh[\"']\s*,\s*[\"']\./run-format\.sh[\"']\s*\]"
    if existing_format is not None and not re.search(expected_command, existing_format):
        raise ValueError(
            "Existing format_commands must be reviewed manually; "
            "add [\"sh\", \"./run-format.sh\"] without discarding existing settings"
        )

    updated = original
    if not updated.endswith("\n"):
        updated += "\n"
    if existing_format is None:
        updated += "\n" + FORMAT_BLOCK
    if find_top_level_block(updated, "checks") is None:
        updated += "\n" + CHECKS_BLOCK

    if updated == original and config.exists():
        return False
    config.parent.mkdir(parents=True, exist_ok=True)
    config.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    try:
        changed = configure(CONFIG_PATH)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    print("apatch FMT configuration updated" if changed else "apatch FMT already configured")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
