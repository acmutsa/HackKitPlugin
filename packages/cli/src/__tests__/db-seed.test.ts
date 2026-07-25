import {
	CorePermission,
	createInMemoryDatabaseAdapterFromStorage,
	createPluginRegistry,
	type DatabaseAdapterFactory,
} from "@hackkit/core";
import { createHackkit } from "@hackkit/core/internal";
import { describe, expect, it } from "vitest";
import { runDbSeed } from "../db-seed";

describe("hackkit db seed", () => {
	it("adds configured roles once and reports later runs as skipped", async () => {
		const registry = createPluginRegistry();
		const databaseAdapter = createInMemoryDatabaseAdapterFromStorage(
			registry.storage,
			() => new Date("2026-07-16T12:00:00.000Z"),
			() => "generated-id",
		);
		const database: DatabaseAdapterFactory = {
			create: () => databaseAdapter,
		};
		const config = {
			database,
			seedRoles: [
				{
					id: "core.participant",
					name: "Participant",
					position: 10,
					permissions: [],
				},
				{
					id: "core.owner",
					name: "Owner",
					position: 0,
					permissions: [CorePermission.SuperAdmin],
				},
			],
		};

		await expect(runDbSeed(config)).resolves.toEqual({
			insertedRoleIds: ["core.participant", "core.owner"],
			skippedRoleIds: [],
		});
		await expect(runDbSeed(config)).resolves.toEqual({
			insertedRoleIds: [],
			skippedRoleIds: ["core.participant", "core.owner"],
		});

		const hackkit = createHackkit({ database: databaseAdapter });
		await expect(hackkit.roles.listRoles()).resolves.toMatchObject([
			{ id: "core.owner", name: "Owner" },
			{ id: "core.participant", name: "Participant" },
		]);
	});
});
