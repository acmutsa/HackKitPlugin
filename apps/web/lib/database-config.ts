import { resolve } from "node:path";
import type { HackKitDatabaseOptions } from "@hackkit/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { LibSqlDriver } from "@mikro-orm/libsql";
import { MySqlDriver } from "@mikro-orm/mysql";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { env } from "../env";

// Next and the application's database scripts run from the application directory.
const appDirectory = process.cwd();
const migrations = {
	path: resolve(
		appDirectory,
		"db/migrations",
		env.databaseDialect === "libsql" ? "sqlite" : env.databaseDialect,
	),
	emit: "ts" as const,
	snapshot: true,
	snapshotName: ".snapshot",
	snapshotOnMigrate: false,
};

function resolveDatabaseOptions(): HackKitDatabaseOptions {
	switch (env.databaseDialect) {
		case "sqlite":
			if (
				/^[a-z][a-z\d+.-]*:/i.test(env.databaseUrl) &&
				!env.databaseUrl.startsWith("file:") &&
				env.databaseUrl !== ":memory:"
			) {
				throw new Error(
					"SQLite DATABASE_URL must be a local file path or :memory:.",
				);
			}
			return {
				driver: SqliteDriver,
				dbName:
					env.databaseUrl === ":memory:"
						? ":memory:"
						: resolve(
								appDirectory,
								env.databaseUrl.replace(/^file:/, ""),
							),
				migrations,
			};
		case "libsql":
			return {
				driver: LibSqlDriver,
				dbName: env.databaseUrl,
				password: env.tursoAuthToken,
				migrations,
			};
		case "mysql":
			return {
				driver: MySqlDriver,
				clientUrl: env.databaseUrl,
				// MySQL DDL commits implicitly. A failed migration can leave
				// partial schema changes even when its history entry is absent.
				migrations: {
					...migrations,
					transactional: false,
					allOrNothing: false,
				},
			};
		case "postgresql":
			return {
				driver: PostgreSqlDriver,
				clientUrl: env.databaseUrl,
				migrations,
			};
	}
}

export const databaseOptions = resolveDatabaseOptions();
