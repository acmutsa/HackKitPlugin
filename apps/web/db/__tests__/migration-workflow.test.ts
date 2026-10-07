import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MikroORM } from "@mikro-orm/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { LibSqlDriver } from "@mikro-orm/libsql";
import { createOrmOptions } from "@hackkit/core";
import { expect, it, vi } from "vitest";
import appConfig from "../../hackkit.config";
import { runDatabaseCommand } from "../../scripts/database";
import { verifyMigrationUpgrade } from "./migration-workflow";

for (const driver of [SqliteDriver, LibSqlDriver]) {
	it(`upgrades existing data, rolls back, retains disabled plugins, and replays fresh with ${driver.name}`, async () => {
		const directory = await mkdtemp(join(tmpdir(), "hackkit-upgrade-"));
		try {
			const config = {
				...appConfig,
				logger: { disabled: true },
				database: {
					driver,
					dbName: join(directory, "upgrade.db"),
					migrations: {
						path: join(process.cwd(), "db/migrations/sqlite"),
						snapshotOnMigrate: false,
					},
				},
			};
			await runDatabaseCommand(config, { command: "migrate" });
			await runDatabaseCommand(config, { command: "seed" });
			const upgrade = await verifyMigrationUpgrade(config, directory);
			const fresh = {
				...upgrade.config,
				database: {
					...upgrade.config.database,
					dbName: join(directory, "fresh.db"),
				},
			};
			await runDatabaseCommand(fresh, { command: "migrate" });
			expect(
				await runDatabaseCommand(fresh, { command: "check" }),
			).toMatchObject({ ok: true });
			const orm = await MikroORM.init(createOrmOptions(fresh));
			try {
				// A reviewed backfill must also work when historical tables are empty.
				expect(
					await orm.em
						.getConnection()
						.execute(
							"select count(*) as count from app_upgrade_note",
						),
				).toEqual([{ count: 0 }]);
			} finally {
				await orm.close();
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
}

it("limits reset to development SQLite and seeds missing roles without changing existing ones", async () => {
	const directory = await mkdtemp(join(tmpdir(), "hackkit-reset-"));
	const config = {
		...appConfig,
		database: {
			driver: SqliteDriver,
			dbName: join(directory, "reset.db"),
			migrations: {
				path: join(process.cwd(), "db/migrations/sqlite"),
				snapshotOnMigrate: false,
			},
		},
	};
	try {
		vi.stubEnv("NODE_ENV", "production");
		await expect(
			runDatabaseCommand(config, { command: "reset" }),
		).rejects.toThrow("development or tests");
		vi.stubEnv("NODE_ENV", "test");
		await expect(
			runDatabaseCommand(
				{
					...config,
					database: {
						...config.database,
						driver: LibSqlDriver,
						dbName: "libsql://example.com",
					},
				},
				{ command: "reset" },
			),
		).rejects.toThrow("local SQLite");
		await runDatabaseCommand(config, { command: "reset" });
		expect(
			await runDatabaseCommand(config, { command: "check" }),
		).toMatchObject({ ok: true });
		expect(
			await runDatabaseCommand(config, { command: "seed" }),
		).toMatchObject({
			seed: {
				insertedRoleIds: [],
				skippedRoleIds: ["core.participant", "core.owner"],
			},
		});
		await runDatabaseCommand(config, { command: "reset" });
		expect(
			await runDatabaseCommand(config, { command: "check" }),
		).toMatchObject({ ok: true });
	} finally {
		vi.unstubAllEnvs();
		await rm(directory, { recursive: true, force: true });
	}
});
