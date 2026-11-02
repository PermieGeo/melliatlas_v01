#!/bin/sh
set -eu
cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is required for formatting." >&2
  exit 2
fi

pnpm format
