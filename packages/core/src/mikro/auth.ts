import type { EntityMetadata, MikroORM } from "@mikro-orm/core";
import { mikroOrmAdapter } from "@a77ay/better-auth-mikro-orm";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getAuthTables } from "better-auth/db";
import { HackKitUser } from "../models.js";

export type HackKitAuthOptions = Omit<
	BetterAuthOptions,
	"database" | "user"
> & {
	user?: Omit<NonNullable<BetterAuthOptions["user"]>, "modelName" | "fields">;
};
const authUserProperties = new Set([
	"id",
	"name",
	"email",
	"emailVerified",
	"profilePhotoUrl",
	"createdAt",
	"updatedAt",
]);
const domainUserProperties = new Set(
	Object.keys(HackKitUser.meta.properties).filter(
		(property) => !authUserProperties.has(property),
	),
);

/** Core owns the canonical user mapping. Domain fields stay behind Core APIs. */
export function resolveHackKitAuthOptions<
	const TOptions extends HackKitAuthOptions,
>(options: TOptions) {
	return {
		...options,
		user: {
			...options.user,
			modelName: "core_user",
			fields: { image: "profilePhotoUrl" },
		},
	};
}

/** Fail startup and migration generation when auth needs an undeclared schema. */
export function assertAuthEntitySchema(
	entities: readonly Pick<
		EntityMetadata,
		"tableName" | "className" | "properties"
	>[],
	options: HackKitAuthOptions,
): void {
	for (const table of Object.values(
		getAuthTables(resolveHackKitAuthOptions(options)),
	)) {
		const entity = entities.find(
			(candidate) =>
				candidate.tableName === table.modelName ||
				candidate.className === table.modelName,
		);
		if (!entity)
			throw new Error(
				`Better Auth model '${table.modelName}' needs a registered native MikroORM entity.`,
			);
		for (const [name, field] of Object.entries(table.fields)) {
			const property = field.fieldName ?? name;
			if (
				entity.tableName === HackKitUser.meta.tableName &&
				domainUserProperties.has(property)
			)
				throw new Error(
					`Better Auth field 'core_user.${property}' is owned by Core and cannot be exposed through auth options.`,
				);
			if (!(property in entity.properties))
				throw new Error(
					`Better Auth field '${table.modelName}.${property}' needs a native MikroORM property and a reviewed migration.`,
				);
		}
	}
}

/** The application supplies credentials and providers; Core owns the database adapter. */
export function createHackKitAuth<const TOptions extends HackKitAuthOptions>(
	orm: MikroORM,
	options: TOptions,
) {
	const authOptions = resolveHackKitAuthOptions(options);
	assertAuthEntitySchema(
		[...orm.getMetadata().getAll().values()],
		authOptions,
	);
	return betterAuth({
		...authOptions,
		database: mikroOrmAdapter(orm),
	});
}
