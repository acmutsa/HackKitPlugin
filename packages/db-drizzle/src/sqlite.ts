import type { AnyField, PersistentModel } from "@hackkit/core";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createDrizzleAdapterFactory } from "./runtime";
import { createDrizzleSchemaAdapter } from "./schema";

export function createDrizzleSqliteSchemaAdapter() {
	return createDrizzleSchemaAdapter("drizzle-sqlite", "sqlite");
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
			column = real(name);
			break;
		case "boolean":
			column = integer(name, { mode: "boolean" });
			break;
		case "date":
			column = integer(name, { mode: "timestamp" });
			break;
		case "json":
			column = text(name, { mode: "json" });
			break;
	}
	if (field.isPrimaryKey) column = column.primaryKey();
	if (field.isUnique) column = column.unique();
	if (!field.isOptional) column = column.notNull();
	return column;
}

function createTable(model: PersistentModel) {
	return sqliteTable(
		model.key.replaceAll(".", "_"),
		Object.fromEntries(
			Object.entries(model.schema.fields).map(([name, field]) => [
				name,
				toColumn(name, field),
			]),
		),
	) as never;
}

export function createDrizzleSqliteAdapter(
	database: unknown | (() => unknown),
) {
	return createDrizzleAdapterFactory(
		database,
		createTable,
		createDrizzleSqliteSchemaAdapter(),
	);
}

export { toDrizzleTableExportName, toDrizzleTableName } from "./schema";
