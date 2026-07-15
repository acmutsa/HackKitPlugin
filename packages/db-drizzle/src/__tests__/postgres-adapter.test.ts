import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defineModel, field } from "@hackkit/core";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import {
	createDrizzlePostgresAdapter,
	createDrizzlePostgresSchemaAdapter,
} from "../postgres";

const postgresUrl = process.env.POSTGRES_TEST_URL;

describe.runIf(postgresUrl)("Drizzle PostgreSQL database adapter", () => {
	it("applies native migrations and supports CRUD", async () => {
		const client = postgres(postgresUrl!, { max: 1 });
		const record = defineModel("sample.record", {
			fields: {
				id: field.string().primaryKey().defaultId(),
				active: field.boolean(),
				score: field.number(),
				metadata: field.json<{ source: string }>(),
				createdAt: field.date().defaultNow(),
			},
		});
		const createdAt = new Date("2026-07-14T12:00:00.000Z");
		let idSequence = 0;
		const db = drizzle(client);

		try {
			await client.unsafe('DROP TABLE IF EXISTS "sample_record"');
			await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
			await migrate(db, {
				migrationsFolder: join(
					process.cwd(),
					"test-fixtures/postgres/migrations",
				),
			});
			const [generatedFile] =
				await createDrizzlePostgresSchemaAdapter().generateSchemaFiles({
					storage: { models: { record } },
				});
			await expect(
				readFile(
					join(process.cwd(), "test-fixtures/postgres/schema.ts"),
					"utf8",
				),
			).resolves.toBe(generatedFile.content);

			const database = createDrizzlePostgresAdapter(db).create({
				storage: { models: { record } },
				now: () => createdAt,
				id: () => `record-${++idSequence}`,
			});

			await expect(
				database.insert(record, {
					active: true,
					score: 9.5,
					metadata: { source: "ci" },
				}),
			).resolves.toEqual({
				id: "record-1",
				active: true,
				score: 9.5,
				metadata: { source: "ci" },
				createdAt,
			});
			await database.insert(record, {
				active: false,
				score: 2,
				metadata: { source: "second" },
			});

			await expect(
				database.findMany(record, {
					orderBy: { field: "score", direction: "desc" },
				}),
			).resolves.toHaveLength(2);
			await expect(
				database.update(record, { id: "record-1" }, { score: 10.25 }),
			).resolves.toMatchObject([{ id: "record-1", score: 10.25 }]);
			await expect(
				database.delete(record, { id: "record-2" }),
			).resolves.toBe(1);
			await expect(
				database.findOne(record, { id: "record-2" }),
			).resolves.toBeNull();
		} finally {
			await client.unsafe('DROP TABLE IF EXISTS "sample_record"');
			await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
			await client.end();
		}
	});
});
