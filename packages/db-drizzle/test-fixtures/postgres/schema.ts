import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const sampleRecord = pgTable("sample_record", {
	id: text("id").primaryKey().notNull(),
	active: boolean("active").notNull(),
	score: doublePrecision("score").notNull(),
	metadata: jsonb("metadata").notNull(),
	createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull()
});
