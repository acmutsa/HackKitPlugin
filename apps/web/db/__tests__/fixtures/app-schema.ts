import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appJob = sqliteTable("app_test_job", {
	id: text("id").primaryKey().notNull(),
	status: text("status").notNull(),
});
