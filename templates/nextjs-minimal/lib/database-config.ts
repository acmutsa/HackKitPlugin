import { resolve } from "node:path";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { env } from "../env";

// Application commands and Next run from this template's directory.
export const databaseOptions = {
	driver: SqliteDriver,
	dbName:
		env.databaseUrl === ":memory:"
			? ":memory:"
			: resolve(env.databaseUrl.replace(/^file:/, "")),
	migrations: {
		path: resolve("db/migrations/sqlite"),
		emit: "ts" as const,
		snapshot: true,
		snapshotName: ".snapshot",
		snapshotOnMigrate: false,
	},
};
