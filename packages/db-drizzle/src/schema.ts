import type {
	AnyField,
	DatabaseSchemaAdapter,
	ModelKey,
	PersistentModel,
	ReferenceAction,
	StorageRegistry,
} from "@hackkit/core";

export type DrizzleDialect = "sqlite" | "postgres";

type CompiledReference = {
	tableExportName: string;
	field: string;
	onDelete?: ReferenceAction;
	onUpdate?: ReferenceAction;
};

type CompiledColumn = {
	name: string;
	field: AnyField;
	reference?: CompiledReference;
};

type CompiledIndex = {
	name: string;
	columns: readonly string[];
	unique: boolean;
};

type CompiledTable = {
	tableName: string;
	exportName: string;
	columns: CompiledColumn[];
	indexes: CompiledIndex[];
};

export function toDrizzleTableName(modelKey: ModelKey): string {
	return modelKey.replaceAll(".", "_");
}

export function toDrizzleTableExportName(modelKey: ModelKey): string {
	const [namespace = "", ...parts] = modelKey.split(".");
	return [namespace, ...parts]
		.map((part, index) =>
			index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
		)
		.join("");
}

function toIdentifier(value: string): string {
	const sanitized = value.replace(/[^a-zA-Z0-9_$]/g, "_");
	return /^[a-zA-Z_$]/.test(sanitized) ? sanitized : `_${sanitized}`;
}

function toIndexName(
	tableName: string,
	columns: readonly string[],
	unique: boolean,
): string {
	return `${tableName}_${columns.join("_")}_${unique ? "uniq" : "idx"}`;
}

function toDrizzleReferenceAction(action: ReferenceAction): string {
	switch (action) {
		case "setNull":
			return "set null";
		case "noAction":
			return "no action";
		default:
			return action;
	}
}

function sortModelsByReferences(storage: StorageRegistry): PersistentModel[] {
	const byKey = new Map(
		Object.values(storage.models).map((model) => [model.key, model]),
	);
	const visited = new Set<ModelKey>();
	const visiting = new Set<ModelKey>();
	const sorted: PersistentModel[] = [];

	function visit(model: PersistentModel) {
		if (visited.has(model.key) || visiting.has(model.key)) return;
		visiting.add(model.key);
		for (const field of Object.values(model.schema.fields)) {
			const referenced = field.reference
				? byKey.get(field.reference.model)
				: undefined;
			if (referenced && referenced.key !== model.key) visit(referenced);
		}
		visiting.delete(model.key);
		visited.add(model.key);
		sorted.push(model);
	}

	for (const model of Object.values(storage.models)) visit(model);
	return sorted;
}

function compileTables(storage: StorageRegistry): CompiledTable[] {
	const tableOwners = new Map<string, ModelKey>();

	return sortModelsByReferences(storage).map((model) => {
		const tableName = toDrizzleTableName(model.key);
		const existingOwner = tableOwners.get(tableName);
		if (existingOwner) {
			throw new Error(
				`Models '${existingOwner}' and '${model.key}' resolve to the same table '${tableName}'.`,
			);
		}
		tableOwners.set(tableName, model.key);

		const columns = Object.entries(model.schema.fields).map(
			([name, field]) => {
				if (field.reference && !storage.models[field.reference.model]) {
					const targetExists = Object.values(storage.models).some(
						(candidate) => candidate.key === field.reference?.model,
					);
					if (!targetExists) {
						throw new Error(
							`Model '${model.key}' references unknown model '${field.reference.model}'.`,
						);
					}
				}

				return {
					name,
					field,
					reference: field.reference
						? {
								tableExportName: toDrizzleTableExportName(
									field.reference.model,
								),
								field: field.reference.field,
								onDelete: field.reference.onDelete,
								onUpdate: field.reference.onUpdate,
							}
						: undefined,
				};
			},
		);

		const indexes: CompiledIndex[] = [
			...(model.schema.unique ?? []).map((columns) => ({
				name: toIndexName(tableName, columns, true),
				columns,
				unique: true,
			})),
			...(model.schema.indexes ?? []).map((columns) => ({
				name: toIndexName(tableName, columns, false),
				columns,
				unique: false,
			})),
		];

		return {
			tableName,
			exportName: toDrizzleTableExportName(model.key),
			columns,
			indexes,
		};
	});
}

function renderDefault(field: AnyField): string | undefined {
	if (field.defaultValue?.kind !== "static") return undefined;
	return `.default(${JSON.stringify(field.defaultValue.value)})`;
}

function renderReference(reference: CompiledReference): string {
	const options = [
		reference.onDelete
			? `onDelete: "${toDrizzleReferenceAction(reference.onDelete)}"`
			: undefined,
		reference.onUpdate
			? `onUpdate: "${toDrizzleReferenceAction(reference.onUpdate)}"`
			: undefined,
	].filter(Boolean);
	const optionsSource =
		options.length > 0 ? `, { ${options.join(", ")} }` : "";
	return `.references(() => ${reference.tableExportName}.${reference.field}${optionsSource})`;
}

function renderColumnFactory(
	field: AnyField,
	name: string,
	dialect: DrizzleDialect,
) {
	if (dialect === "sqlite") {
		switch (field.kind) {
			case "string":
			case "enum":
				return `text("${name}")`;
			case "integer":
				return `integer("${name}")`;
			case "number":
				return `real("${name}")`;
			case "boolean":
				return `integer("${name}", { mode: "boolean" })`;
			case "date":
				return `integer("${name}", { mode: "timestamp" })`;
			case "json":
				return `text("${name}", { mode: "json" })`;
		}
	}

	switch (field.kind) {
		case "string":
		case "enum":
			return `text("${name}")`;
		case "integer":
			return `integer("${name}")`;
		case "number":
			return `doublePrecision("${name}")`;
		case "boolean":
			return `boolean("${name}")`;
		case "date":
			return `timestamp("${name}", { withTimezone: true, mode: "date" })`;
		case "json":
			return `jsonb("${name}")`;
	}
}

function renderTable(table: CompiledTable, dialect: DrizzleDialect): string {
	const columns = table.columns.map((column) => {
		let source = renderColumnFactory(column.field, column.name, dialect);
		if (column.field.isPrimaryKey) source += ".primaryKey()";
		if (!column.field.isOptional) source += ".notNull()";
		if (column.field.isUnique) source += ".unique()";
		if (column.reference) source += renderReference(column.reference);
		source += renderDefault(column.field) ?? "";
		return `\t${column.name}: ${source}`;
	});
	const indexes = table.indexes.map((definition) => {
		const factory = definition.unique ? "uniqueIndex" : "index";
		const indexedColumns = definition.columns
			.map((column) => `table.${column}`)
			.join(", ");
		return `\t${toIdentifier(definition.name)}: ${factory}("${definition.name}").on(${indexedColumns})`;
	});
	const extraConfig =
		indexes.length > 0 ? `, (table) => ({\n${indexes.join(",\n")}\n})` : "";
	const tableFactory = dialect === "sqlite" ? "sqliteTable" : "pgTable";
	return `export const ${table.exportName} = ${tableFactory}("${table.tableName}", {\n${columns.join(",\n")}\n}${extraConfig});\n`;
}

function importsFor(dialect: DrizzleDialect): string {
	return dialect === "sqlite"
		? 'import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";'
		: 'import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";';
}

export function compileDrizzleSchema(
	storage: StorageRegistry,
	dialect: DrizzleDialect,
): string {
	const tables = compileTables(storage);
	return [
		importsFor(dialect),
		"",
		...tables.map((table) => renderTable(table, dialect)),
	].join("\n");
}

export function createDrizzleSchemaAdapter(
	id: string,
	dialect: DrizzleDialect,
): DatabaseSchemaAdapter {
	return {
		id,
		generateSchemaFiles({ storage }) {
			return [
				{
					path: "hackkit.ts",
					content: compileDrizzleSchema(storage, dialect),
				},
			];
		},
	};
}
