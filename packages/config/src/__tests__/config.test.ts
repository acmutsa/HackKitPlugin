import { SqliteDriver } from "@mikro-orm/sqlite";
import { describe, expect, expectTypeOf, it } from "vitest";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	defineHackkitConfig,
	loadHackkitConfig,
	resolveHackkitConfig,
} from "../index";

describe("HackKit config", () => {
	it("normalizes optional collection fields", () => {
		const database = { driver: SqliteDriver, dbName: ":memory:" };
		const config = resolveHackkitConfig(
			defineHackkitConfig({
				database,
				auth: { secret: "test-secret-that-is-at-least-32-characters" },
			}),
		);

		expect(config.plugins).toEqual([]);
		expect(config.seedRoles).toEqual([]);
		expect(config.database).toBe(database);
	});

	it("loads a config through the shared loader", async () => {
		const cwd = dirname(fileURLToPath(import.meta.url));
		const config = await loadHackkitConfig("fixtures/hackkit.config.ts", {
			cwd,
		});
		expect(config.database.dbName).toBe(":memory:");
		expect(config.plugins).toEqual([]);
	});
});

it("preserves plugin tuples through normalization and represents omitted plugins as empty", () => {
	const config = resolveHackkitConfig(
		defineHackkitConfig({
			database: { driver: SqliteDriver, dbName: ":memory:" },
			auth: {},
			plugins: [{ id: "example", setup: () => ({ answer: 42 }) }],
		}),
	);
	expectTypeOf(config.plugins[0].id).toEqualTypeOf<"example">();
	expectTypeOf(config.plugins[0].setup().answer).toEqualTypeOf<number>();
	const empty = resolveHackkitConfig({
		database: { driver: SqliteDriver, dbName: ":memory:" },
		auth: {},
	});
	expectTypeOf(empty.plugins).toEqualTypeOf<[]>();
});
