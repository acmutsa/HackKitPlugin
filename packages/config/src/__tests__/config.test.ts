import { describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	defineHackkitConfig,
	loadHackkitConfig,
	resolveHackkitConfig,
} from "../index";

describe("HackKit config", () => {
	it("normalizes optional collection fields", () => {
		const database = { create: () => ({}) as never };
		const config = resolveHackkitConfig(
			defineHackkitConfig({
				database,
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
		expect(config.seedRoles.map((role) => role.id)).toContain(
			"core.participant",
		);
	});
});
