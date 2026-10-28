import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config as loadEnv } from "dotenv";
import { createJiti } from "jiti";
import { Kysely, sql } from "kysely";

loadEnv({ path: ".dev.vars", quiet: true });
const jiti = createJiti(import.meta.url);
const { HttpLibsqlDialect } = await jiti.import(
	"../lib/http-libsql-dialect.ts",
);
const { env, assertDemoEnvironment } = await jiti.import("../env.ts");
assertDemoEnvironment();

test("HTTP libSQL isolates connections and rolls back nested and outer transactions", async () => {
	const dialect = new HttpLibsqlDialect({
		url: env.databaseUrl,
		authToken: env.tursoAuthToken,
	});
	assert.equal(dialect.createAdapter().supportsMultipleConnections, true);
	const db = new Kysely({ dialect });
	const key = `demo-transaction-test:${randomUUID()}`;
	try {
		const transaction = await db.startTransaction().execute();
		try {
			await sql`insert into core_operation_lock (key, token) values (${key}, ${"outer"})`.execute(
				transaction,
			);
			const nested = await transaction.savepoint("nested").execute();
			await sql`update core_operation_lock set token = ${"inner"} where key = ${key}`.execute(
				nested,
			);
			await nested.rollbackToSavepoint("nested").execute();
			const result =
				await sql`select token from core_operation_lock where key = ${key}`.execute(
					nested,
				);
			assert.equal(result.rows[0].token, "outer");
			await nested.releaseSavepoint("nested").execute();
		} finally {
			await transaction.rollback().execute();
		}
		const result =
			await sql`select token from core_operation_lock where key = ${key}`.execute(
				db,
			);
		assert.equal(result.rows.length, 0);
		const reads = await Promise.all(
			Array.from({ length: 4 }, () => sql`select 1 as value`.execute(db)),
		);
		assert.ok(reads.every((result) => result.rows[0].value === 1));
	} finally {
		await db.destroy();
	}
});
