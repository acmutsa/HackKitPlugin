#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-file:.data/web.db}"

if [[ "$DATABASE_URL" != file:* ]]; then
	echo "Refusing to reset non-local database: $DATABASE_URL" >&2
	exit 1
fi

DATABASE_PATH="${DATABASE_URL#file:}"
DATABASE_PATH="${DATABASE_PATH%%\?*}"
if [[ "$DATABASE_PATH" != /* ]]; then
	DATABASE_PATH="$ROOT/$DATABASE_PATH"
fi

rm -f "$DATABASE_PATH" "$DATABASE_PATH-wal" "$DATABASE_PATH-shm"
mkdir -p "$(dirname "$DATABASE_PATH")"

cd "$ROOT"

pnpm db:migrate

echo "Reset complete: $DATABASE_PATH"
