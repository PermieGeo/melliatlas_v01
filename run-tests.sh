#!/bin/sh
# Canonical non-formatting check entry point for apatch CHK and local development.
set -eu
cd "$(dirname "$0")"

# Keep Python validation read-only, including transitive imports.
export PYTHONDONTWRITEBYTECODE=1

if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: Node.js 22+ and pnpm must be installed before running checks." >&2
  exit 2
fi

if [ -z "${DATABASE_URL:-}" ] && [ -f apps/api/.env ]; then
  DATABASE_URL="$(node -e 'process.loadEnvFile("apps/api/.env"); process.stdout.write(process.env.DATABASE_URL || "")')"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required for PostGIS checks; set it or create apps/api/.env." >&2
  exit 2
fi
export DATABASE_URL

# Integration tests create and drop schemas; never allow checks to target a remote database.
node -e '
  let url;
  try { url = new URL(process.env.DATABASE_URL); }
  catch { console.error("ERROR: Invalid DATABASE_URL"); process.exit(2); }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    console.error("ERROR: DATABASE_URL must be a PostgreSQL URL"); process.exit(2);
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    console.error("ERROR: PostGIS checks require a local database; remote DATABASE_URL is refused.");
    process.exit(2);
  }
'

python3 -B -m unittest discover -s scripts -p "test_enable_apatch_fmt.py"
python3 -B tools/specs/validate_state.py
pnpm format:check
pnpm typecheck
pnpm test
node --test scripts/check-saturn-api.test.mjs
pnpm build
pnpm --dir apps/api test:db
pnpm e2e
