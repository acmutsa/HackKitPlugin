import type {
	DatabaseAdapter,
	InferInsert,
	InferSelect,
	Model,
} from "@hackkit/core";
import type { BetterAuthPlugin } from "better-auth";
import { toBetterAuthFieldName, toBetterAuthModelName } from "./schema";

type BetterAuthAdapter = Parameters<
	NonNullable<BetterAuthPlugin["init"]>
>[0]["adapter"];

type Row = Record<string, unknown>;

function applyDefaults<TModel extends Model>(
	model: TModel,
	value: InferInsert<TModel>,
	now: () => Date,
	id: () => string,
): InferSelect<TModel> {
	const row: Row = { ...value };
	for (const [name, field] of Object.entries(model.schema.fields)) {
		if (row[name] !== undefined || !field.defaultValue) continue;
		switch (field.defaultValue.kind) {
			case "static":
				row[name] = field.defaultValue.value;
				break;
			case "now":
				row[name] = now();
				break;
			case "id":
				row[name] = id();
				break;
		}
	}
	return row as InferSelect<TModel>;
}

function toStorageRow(model: Model, row: Row): Row {
	if (model.key !== "core.user") return { ...row };
	const { authId, profilePhotoUrl, firstName, lastName, ...rest } = row;
	return {
		...rest,
		...(authId === undefined ? {} : { id: authId }),
		...(profilePhotoUrl === undefined ? {} : { image: profilePhotoUrl }),
		...(firstName === undefined ? {} : { firstName }),
		...(lastName === undefined ? {} : { lastName }),
		...(firstName === undefined && lastName === undefined
			? {}
			: {
					name: `${String(firstName ?? "")} ${String(lastName ?? "")}`.trim(),
				}),
	};
}

function fromStorageRow<TModel extends Model>(
	model: TModel,
	row: Row,
): InferSelect<TModel> {
	if (model.key !== "core.user") return row as InferSelect<TModel>;
	const { id, image, name: _name, emailVerified: _verified, ...rest } = row;
	return {
		...rest,
		authId: id,
		profilePhotoUrl: image ?? undefined,
		skills: rest.skills ?? [],
	} as unknown as InferSelect<TModel>;
}

function toWhere(model: Model, where: Record<string, unknown>) {
	return Object.entries(where).map(([field, value]) => ({
		field: toBetterAuthFieldName(model.key, field),
		value: value as
			| string
			| number
			| boolean
			| string[]
			| number[]
			| Date
			| null,
	}));
}

export function createBetterAuthDatabase(
	adapter: BetterAuthAdapter,
	options: { now?: () => Date; id?: () => string } = {},
): DatabaseAdapter {
	const now = options.now ?? (() => new Date());
	const id = options.id ?? (() => crypto.randomUUID());

	const database: DatabaseAdapter = {
		async insert(model, value) {
			const row = applyDefaults(model, value, now, id) as Row;
			const stored = await adapter.create<Row, Row>({
				model: toBetterAuthModelName(model.key),
				data: toStorageRow(model, row),
				forceAllowId: row.id !== undefined || model.key === "core.user",
			});
			return fromStorageRow(model, stored);
		},

		async findOne(model, where) {
			const row = await adapter.findOne<Row>({
				model: toBetterAuthModelName(model.key),
				where: toWhere(model, where as Row),
			});
			return row ? fromStorageRow(model, row) : null;
		},

		async findMany(model, options) {
			const rows = await adapter.findMany<Row>({
				model: toBetterAuthModelName(model.key),
				where: options?.where
					? toWhere(model, options.where as Row)
					: undefined,
				limit: options?.limit,
				sortBy: options?.orderBy
					? {
							field: toBetterAuthFieldName(
								model.key,
								String(options.orderBy.field),
							),
							direction: options.orderBy.direction ?? "asc",
						}
					: undefined,
			});
			return rows.map((row) => fromStorageRow(model, row));
		},

		async update(model, where, patch) {
			const storagePatch = toStorageRow(model, patch as Row);
			if (
				model.key === "core.user" &&
				("firstName" in patch || "lastName" in patch)
			) {
				const existing = await database.findOne(model, where);
				if (existing) {
					storagePatch.name =
						`${String((patch as Row).firstName ?? existing.firstName)} ${String((patch as Row).lastName ?? existing.lastName)}`.trim();
				}
			}
			await adapter.updateMany({
				model: toBetterAuthModelName(model.key),
				where: toWhere(model, where as Row),
				update: storagePatch,
			});
			return database.findMany(model, { where });
		},

		async delete(model, where) {
			return adapter.deleteMany({
				model: toBetterAuthModelName(model.key),
				where: toWhere(model, where as Row),
			});
		},
	};

	return database;
}
