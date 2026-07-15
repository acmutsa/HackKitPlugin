import type { AnyField, PersistentModel } from "@hackkit/core";
import {
	boolean,
	doublePrecision,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { createDrizzleAdapterFactory } from "./runtime";
import { createDrizzleSchemaAdapter } from "./schema";

export function createDrizzlePostgresSchemaAdapter() {
	return createDrizzleSchemaAdapter("drizzle-postgres", "postgres");
}

function toColumn(name: string, field: AnyField) {
	let column: any;
	switch (field.kind) {
		case "string":
		case "enum":
			column = text(name);
			break;
		case "integer":
			column = integer(name);
			break;
		case "number":
			column = doublePrecision(name);
			break;
		case "boolean":
			column = boolean(name);
			break;
		case "date":
			column = timestamp(name, { withTimezone: true, mode: "date" });
			break;
		case "json":
			column = jsonb(name);
			break;
	}
	if (field.isPrimaryKey) column = column.primaryKey();
	if (field.isUnique) column = column.unique();
	if (!field.isOptional) column = column.notNull();
	return column;
}

function createTable(model: PersistentModel) {
	return pgTable(
		model.key.replaceAll(".", "_"),
		Object.fromEntries(
			Object.entries(model.schema.fields).map(([name, field]) => [
				name,
				toColumn(name, field),
			]),
		),
	) as never;
}

export function createDrizzlePostgresAdapter(
	database: unknown | (() => unknown),
) {
	return createDrizzleAdapterFactory(
		database,
		createTable,
		createDrizzlePostgresSchemaAdapter(),
	);
}

export { toDrizzleTableExportName, toDrizzleTableName } from "./schema";
