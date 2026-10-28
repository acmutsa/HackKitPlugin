import { SqliteDriver } from "@mikro-orm/sql";
import { HttpLibsqlDialect } from "./http-libsql-dialect";
import type { HackKitDatabaseOptions } from "@hackkit/core";
import { env } from "../env";

// The generic SQLite driver accepts a Kysely dialect without loading native
// SQLite binaries. The web client uses Turso's HTTP API and supports transactions.
export const databaseOptions = {
	driver: SqliteDriver,
	dbName: "hackkit-demo",
	driverOptions: () =>
		new HttpLibsqlDialect({
			url: env.databaseUrl ?? "http://127.0.0.1:9",
			authToken: env.tursoAuthToken,
		}),
} satisfies HackKitDatabaseOptions;
