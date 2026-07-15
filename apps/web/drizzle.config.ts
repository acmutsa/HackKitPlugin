import { defineConfig } from "drizzle-kit";
import { env } from "./env";

export default defineConfig({
	schema: "./db/schema/**/*.ts",
	out: "./db/migrations",
	dialect: "turso",
	dbCredentials: {
		url: env.databaseUrl,
		authToken: env.tursoAuthToken,
	},
});
