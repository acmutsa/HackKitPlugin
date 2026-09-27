import { resolve } from "node:path";
import type { HackKitDatabaseOptions } from "@hackkit/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { LibSqlDriver } from "@mikro-orm/libsql";
import { MySqlDriver } from "@mikro-orm/mysql";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { env } from "../env";

// Next and the HackKit CLI run from the application directory.
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
				migrations,
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
