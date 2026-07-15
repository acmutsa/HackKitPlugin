import { defineModel, field } from "@hackkit/core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { createDrizzlePostgresAdapter } from "../postgres";

const postgresUrl = process.env.POSTGRES_TEST_URL;

describe.runIf(postgresUrl)("Drizzle PostgreSQL database adapter", () => {
	it("persists native PostgreSQL values through the public adapter", async () => {
		const client = postgres(postgresUrl!, { max: 1 });
		await client.unsafe('DROP TABLE IF EXISTS "sample_record"');
		await client.unsafe(`CREATE TABLE "sample_record" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"active" BOOLEAN NOT NULL,
			"score" DOUBLE PRECISION NOT NULL,
			"metadata" JSONB NOT NULL,
			"createdAt" TIMESTAMPTZ NOT NULL
		)`);
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
		const database = createDrizzlePostgresAdapter(drizzle(client)).create({
			storage: { models: { record } },
			now: () => createdAt,
			id: () => "record-1",
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

		await client.unsafe('DROP TABLE "sample_record"');
		await client.end();
	});
});
