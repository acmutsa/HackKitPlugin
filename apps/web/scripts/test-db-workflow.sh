#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$ROOT/.data/db-workflow-test"

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
trap 'rm -rf "$TEST_DIR"' EXIT

cd "$ROOT"

auth_before="$(git hash-object db/schema/auth.ts)"
hackkit_before="$(git hash-object db/schema/hackkit.ts)"

DATABASE_URL="file:$TEST_DIR/sync-must-not-connect.db" pnpm sync

test ! -e "$TEST_DIR/sync-must-not-connect.db"
test "$auth_before" = "$(git hash-object db/schema/auth.ts)"
test "$hackkit_before" = "$(git hash-object db/schema/hackkit.ts)"

if DATABASE_URL="libsql://remote.example.com" pnpm db:reset >/dev/null 2>&1; then
	echo "db:reset accepted a remote URL" >&2
	exit 1
fi

printf 'leave me alone\n' >"$TEST_DIR/untouched.db"
DATABASE_URL="file:$TEST_DIR/selected.db" pnpm db:reset

test -f "$TEST_DIR/selected.db"
test "$(cat "$TEST_DIR/untouched.db")" = "leave me alone"

node --input-type=module -e '
	import { createClient } from "@libsql/client";
	const client = createClient({ url: process.argv[1] });
	const result = await client.execute({
		sql: "SELECT name FROM sqlite_master WHERE type = ? AND name IN (?, ?)",
		args: ["table", "core_user", "user"],
	});
	client.close();
	if (result.rows.length !== 2) process.exit(1);
' "file:$TEST_DIR/selected.db"

echo "Database workflow isolation checks passed."
