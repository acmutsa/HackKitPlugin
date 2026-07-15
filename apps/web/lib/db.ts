import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../env";

let database: ReturnType<typeof drizzle> | undefined;

export function getDb() {
	if (database) return database;
	const client = createClient({
		url: env.databaseUrl,
		authToken: env.tursoAuthToken,
	});
	database = drizzle(client);
	return database;
}
