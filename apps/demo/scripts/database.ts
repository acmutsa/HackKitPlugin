import { resolve } from "node:path";
import { resolveHackkitConfig, type HackkitConfig } from "@hackkit/config";
import { createOrmOptions, seedRoles } from "@hackkit/core";
import { MikroORM } from "@mikro-orm/core";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

export type DatabaseCommand =
	| { command: "generate"; name?: string; blank?: boolean }
	| { command: "status" | "check" | "seed" | "reset" }
	| { command: "migrate"; to?: string }
	| { command: "rollback"; to?: string };

/** Runs an explicit database operation. App startup never calls this function. */
export async function runDatabaseCommand(
	input: HackkitConfig,
	request: DatabaseCommand,
) {
	if (request.command === "reset")
		throw new Error(
			"Reset is disabled for the shared Turso demo database.",
		);
	const config = resolveHackkitConfig({
		...input,
		database: {
			...input.database,
			migrations: {
				path: resolve("db/migrations/sqlite"),
				emit: "ts",
				snapshot: true,
				snapshotName: ".snapshot",
				snapshotOnMigrate: false,
			},
		},
	});
	const orm = await MikroORM.init({
		...createOrmOptions(config),
		dynamicImportProvider: (id) => jiti.import(id),
	});
	try {
		// MikroORM 7 initializes lazily. History operations must establish a
		// connection first: native getPending can otherwise report all files
		// as pending when a snapshot exists but the database is unreachable.
		if (request.command !== "generate") await orm.connect();
		const migrator = orm.migrator;
		switch (request.command) {
			case "generate": {
				const migration = await migrator.create(
					undefined,
					request.blank,
					false,
					request.name,
				);
				return {
					command: "generate" as const,
					migration,
					// SQLite table rebuilding also contains DROP TABLE. Review the
					// complete migration; this list is a warning, not an SQL parser.
					destructiveStatements: migration.diff.up.filter((sql) =>
						/\bdrop\s+(?:table|column|schema)\b|\btruncate\b/i.test(
							sql,
						),
					),
				};
			}
			case "status":
			case "check": {
				// Native migrator history calls ensure its tracking table exists.
				const executed = await migrator.getExecuted();
				const pending = await migrator.getPending();
				if (request.command === "status")
					return { command: "status" as const, executed, pending };
				// checkSchema compares entities to the committed snapshot. Separately
				// compare the live database so a clean snapshot cannot hide drift.
				const needsMigration = await migrator.checkSchema();
				const schemaSql = await orm.schema.getUpdateSchemaSQL({
					wrap: false,
				});
				return {
					command: "check" as const,
					executed,
					pending,
					needsMigration,
					schemaSql,
					ok:
						!needsMigration &&
						pending.length === 0 &&
						schemaSql.trim() === "",
				};
			}
			case "migrate":
				return {
					command: "migrate" as const,
					migrations: await migrator.up(
						request.to ? { to: request.to } : undefined,
					),
				};
			case "rollback":
				return {
					command: "rollback" as const,
					migrations: await migrator.down(
						request.to
							? { to: request.to === "0" ? 0 : request.to }
							: undefined,
					),
				};
			case "seed":
				return {
					command: "seed" as const,
					seed: await seedRoles({
						em: orm.em.fork(),
						roles: config.seedRoles,
					}),
				};
		}
	} finally {
		await orm.close();
	}
}
