#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hackkit-db-workflow.XXXXXX")"
export HACKKIT_DATABASE_DIALECT=sqlite
trap 'rm -rf "$TEST_DIR"' EXIT

cd "$ROOT"

DATABASE_URL="file:$TEST_DIR/sync-must-not-connect.db" pnpm sync
test ! -e "$TEST_DIR/sync-must-not-connect.db"

# Exercise the actual Node entry point, including check's nonzero exit code.
DATABASE_URL="file:$TEST_DIR/selected.db" node scripts/db.mjs status >"$TEST_DIR/status.json"
if DATABASE_URL="file:$TEST_DIR/selected.db" node scripts/db.mjs check >"$TEST_DIR/check.json"; then
	echo "db:check accepted an unmigrated database" >&2
	exit 1
fi
node --input-type=module -e '
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  const status = JSON.parse(readFileSync(process.argv[1], "utf8"));
  const check = JSON.parse(readFileSync(process.argv[2], "utf8"));
  assert.equal(status.executed.length, 0);
  assert.equal(status.pending.length, 1);
  assert.equal(check.ok, false);
  assert.equal(check.needsMigration, false);
  assert.ok(check.schemaSql.includes("core_user"));
' "$TEST_DIR/status.json" "$TEST_DIR/check.json"

if DATABASE_URL="libsql://remote.example.com" pnpm db:reset >/dev/null 2>&1; then
	echo "db:reset accepted a remote URL" >&2
	exit 1
fi

printf 'leave me alone\n' >"$TEST_DIR/untouched.db"
DATABASE_URL="file:$TEST_DIR/selected.db" pnpm db:reset
DATABASE_URL="file:$TEST_DIR/selected.db" node scripts/db.mjs check >"$TEST_DIR/checked.json"

test -f "$TEST_DIR/selected.db"
test "$(cat "$TEST_DIR/untouched.db")" = "leave me alone"

node --input-type=module -e '
  import { MikroORM, SqliteDriver } from "@mikro-orm/sqlite";
  import { coreModels, authEntities } from "@hackkit/core";
  const orm = await MikroORM.init({driver: SqliteDriver, dbName: process.argv[1], entities: [...Object.values(coreModels), ...authEntities]});
  try {
    const roles = await orm.em.fork().find(coreModels.role, {}, {orderBy: {id: "asc"}});
    if (JSON.stringify(roles.map(role => role.id)) !== JSON.stringify(["core.owner", "core.participant"])) process.exitCode = 1;
  } finally { await orm.close(); }
' "$TEST_DIR/selected.db"

echo "Database workflow isolation checks passed."
