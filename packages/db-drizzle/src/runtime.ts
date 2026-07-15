import { and, asc, desc, eq } from "drizzle-orm";
import type {
	DatabaseAdapter,
	DatabaseAdapterFactory,
	DatabaseAdapterFactoryContext,
	DatabaseSchemaAdapter,
	InferInsert,
	InferSelect,
	Model,
	ModelKey,
	PersistentModel,
} from "@hackkit/core";

export type DrizzleTable = Record<string, unknown>;
export type DrizzleTableFactory = (model: PersistentModel) => DrizzleTable;

function applyDefaults<TModel extends Model>(
	model: TModel,
	value: InferInsert<TModel>,
	context: DatabaseAdapterFactoryContext,
): InferSelect<TModel> {
	const row: Record<string, unknown> = { ...value };

	for (const [name, field] of Object.entries(model.schema.fields)) {
		if (row[name] !== undefined || !field.defaultValue) continue;
		switch (field.defaultValue.kind) {
			case "static":
				row[name] = field.defaultValue.value;
				break;
			case "now":
				row[name] = context.now();
				break;
			case "id":
				row[name] = context.id();
				break;
		}
	}

	return row as InferSelect<TModel>;
}

function toWhere(table: DrizzleTable, where: Record<string, unknown>) {
	const clauses = Object.entries(where).map(([key, value]) =>
		eq(table[key] as never, value),
	);
	if (clauses.length === 0) return undefined;
	if (clauses.length === 1) return clauses[0];
	return and(...clauses);
}

export function createDrizzleAdapterFactory(
	database: unknown | (() => unknown),
	createTable: DrizzleTableFactory,
	schema: DatabaseSchemaAdapter,
): DatabaseAdapterFactory {
	return {
		schema,
		create(context) {
			const db: any =
				typeof database === "function" ? database() : database;
			const tables = Object.fromEntries(
				Object.values(context.storage.models).map((model) => [
					model.key,
					createTable(model),
				]),
			) as Record<ModelKey, DrizzleTable>;

			const adapter: DatabaseAdapter = {
				async insert(model, value) {
					const [inserted] = await db
						.insert(tables[model.key])
						.values(applyDefaults(model, value, context))
						.returning();
					return inserted as InferSelect<typeof model>;
				},

				async findOne(model, where) {
					const [row] = await adapter.findMany(model, {
						where,
						limit: 1,
					});
					return row ?? null;
				},

				async findMany(model, options) {
					const table = tables[model.key];
					let query = db.select().from(table);
					const condition = options?.where
						? toWhere(
								table,
								options.where as Record<string, unknown>,
							)
						: undefined;
					if (condition) query = query.where(condition);
					if (options?.orderBy) {
						const column = table[String(options.orderBy.field)];
						query = query.orderBy(
							options.orderBy.direction === "desc"
								? desc(column as never)
								: asc(column as never),
						);
					}
					if (options?.limit !== undefined)
						query = query.limit(options.limit);
					return (await query) as InferSelect<typeof model>[];
				},

				async update(model, where, patch) {
					const table = tables[model.key];
					let query = db.update(table).set(patch);
					const condition = toWhere(
						table,
						where as Record<string, unknown>,
					);
					if (condition) query = query.where(condition);
					return (await query.returning()) as InferSelect<
						typeof model
					>[];
				},

				async delete(model, where) {
					const table = tables[model.key];
					let query = db.delete(table);
					const condition = toWhere(
						table,
						where as Record<string, unknown>,
					);
					if (condition) query = query.where(condition);
					const deleted = await query.returning();
					return deleted.length;
				},
			};

			return adapter;
		},
	};
}
