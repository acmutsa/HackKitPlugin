import { SqliteDriver } from "@mikro-orm/sqlite";
import { describe, expect, expectTypeOf, it } from "vitest";
import { dirname, resolve } from "node:path";
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

	it("loads the web HackKit config through the shared loader", async () => {
		const repoRoot = resolve(
			dirname(fileURLToPath(import.meta.url)),
			"../../../..",
		);
		const config = await loadHackkitConfig("apps/web/hackkit.config.ts", {
			cwd: repoRoot,
		});

		expect(config.database).toBeDefined();
		expect(config.plugins.map((plugin) => plugin.id)).toEqual([
			"teams",
			"discord",
			"notificationsEmail",
		]);
		expect(config.seedRoles.map((role) => role.id)).toEqual([
			"core.participant",
			"core.owner",
		]);
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
