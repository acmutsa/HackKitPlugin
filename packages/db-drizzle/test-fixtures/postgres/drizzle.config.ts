import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./test-fixtures/postgres/schema.ts",
	out: "./test-fixtures/postgres/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.POSTGRES_TEST_URL ??
			"postgres://postgres:postgres@localhost:5432/hackkit",
	},
});
