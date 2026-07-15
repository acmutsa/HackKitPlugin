import { createClient } from "@libsql/client";
import { defineModel, field } from "@hackkit/core";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import { createDrizzleLibsqlAdapter } from "../libsql";

describe("Drizzle libSQL database adapter", () => {
	it("persists HackKit models through the public adapter factory", async () => {
		const client = createClient({ url: ":memory:" });
		await client.execute(
			'CREATE TABLE "sample_note" ("id" TEXT PRIMARY KEY NOT NULL, "body" TEXT NOT NULL, "position" INTEGER NOT NULL)',
		);
		const note = defineModel("sample.note", {
			fields: {
				id: field.string().primaryKey().defaultId(),
				body: field.string(),
				position: field.integer(),
			},
		});
		let idSequence = 0;
		const database = createDrizzleLibsqlAdapter(drizzle(client)).create({
			storage: { models: { note } },
			now: () => new Date("2026-01-01T00:00:00.000Z"),
			id: () => `note-${++idSequence}`,
		});

		await expect(
			database.insert(note, { body: "First", position: 2 }),
		).resolves.toEqual({ id: "note-1", body: "First", position: 2 });
		await database.insert(note, { body: "Second", position: 1 });

		await expect(
			database.findMany(note, {
				orderBy: { field: "position", direction: "asc" },
			}),
		).resolves.toEqual([
			{ id: "note-2", body: "Second", position: 1 },
			{ id: "note-1", body: "First", position: 2 },
		]);

		await expect(
			database.update(note, { position: 2 }, { body: "Updated" }),
		).resolves.toEqual([{ id: "note-1", body: "Updated", position: 2 }]);
		await expect(database.delete(note, { position: 1 })).resolves.toBe(1);
		await expect(
			database.findOne(note, { position: 1 }),
		).resolves.toBeNull();

		client.close();
	});
});
