import type {
	AnyField,
	HackKitPlugin,
	PersistentModel,
	ReferenceAction,
} from "@hackkit/core";
import { createPluginRegistry } from "@hackkit/core";
import type { BetterAuthPlugin } from "better-auth";

export function toBetterAuthModelName(modelKey: string): string {
	if (modelKey === "core.user") return "user";
	const [namespace, name] = modelKey.split(".");
	if (!namespace || !name)
		throw new Error(`Invalid HackKit model key '${modelKey}'.`);
	return `${namespace}${name[0]!.toUpperCase()}${name.slice(1)}`;
}

export function toBetterAuthFieldName(modelKey: string, field: string): string {
	if (modelKey !== "core.user") return field;
	if (field === "authId") return "id";
	if (field === "profilePhotoUrl") return "image";
	return field;
}

function toFieldType(field: AnyField) {
	switch (field.kind) {
		case "integer":
		case "number":
			return "number" as const;
		case "enum":
			return field.enumValues as [string, ...string[]];
		default:
			return field.kind;
	}
}

function toDeleteAction(action?: ReferenceAction) {
	if (action === "setNull") return "set null" as const;
	if (action === "noAction") return "no action" as const;
	return action;
}

function isBetterAuthOwnedUserField(name: string): boolean {
	return [
		"authId",
		"email",
		"profilePhotoUrl",
		"createdAt",
		"updatedAt",
	].includes(name);
}

function toModelSchema(model: PersistentModel) {
	const indexed = new Set(
		(model.schema.indexes ?? [])
			.filter((fields) => fields.length === 1)
			.flat(),
	);
	return {
		...(model.key === "core.user"
			? {}
			: { modelName: toBetterAuthModelName(model.key) }),
		fields: Object.fromEntries(
			Object.entries(model.schema.fields)
				.filter(
					([name]) =>
						name !== "id" &&
						!(
							model.key === "core.user" &&
							isBetterAuthOwnedUserField(name)
						),
				)
				.map(([name, field]) => [
					name,
					{
						type: toFieldType(field),
						required:
							model.key === "core.user" &&
							(name === "firstName" ||
								name === "lastName" ||
								field.kind === "json")
								? false
								: !field.isOptional,
						unique: field.isUnique || field.isPrimaryKey,
						index: indexed.has(name),
						...(field.defaultValue?.kind === "static" &&
						(typeof field.defaultValue.value === "string" ||
							typeof field.defaultValue.value === "number" ||
							typeof field.defaultValue.value === "boolean")
							? { defaultValue: field.defaultValue.value }
							: {}),
						...(field.reference
							? {
									references: {
										model: toBetterAuthModelName(
											field.reference.model,
										),
										field: toBetterAuthFieldName(
											field.reference.model,
											field.reference.field,
										),
										onDelete: toDeleteAction(
											field.reference.onDelete,
										),
									},
								}
							: {}),
					},
				]),
		),
	};
}

export function createHackkitBetterAuthSchema(
	plugins: readonly HackKitPlugin[] = [],
): NonNullable<BetterAuthPlugin["schema"]> {
	const registry = createPluginRegistry(plugins);
	const schema: Record<string, ReturnType<typeof toModelSchema>> = {};
	const sourceByName = new Map<string, string>();
	for (const model of Object.values(registry.storage.models)) {
		const name = toBetterAuthModelName(model.key);
		const existing = sourceByName.get(name);
		if (existing) {
			throw new Error(
				`HackKit models '${existing}' and '${model.key}' both map to Better Auth model '${name}'.`,
			);
		}
		sourceByName.set(name, model.key);
		schema[name] = toModelSchema(model);
	}
	return schema as unknown as NonNullable<BetterAuthPlugin["schema"]>;
}
