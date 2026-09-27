import type { EntityMetadata, MikroORM } from "@mikro-orm/core";
import { mikroOrmAdapter } from "@a77ay/better-auth-mikro-orm";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getAuthTables } from "better-auth/db";
import { HackKitProfile } from "./profile.js";
import { AuthUser } from "./auth-entities.js";
import type { FlushEventArgs } from "@mikro-orm/core";

export type HackKitAuthOptions = Omit<BetterAuthOptions, "database">;

/** Fail startup and migration generation when auth needs an undeclared schema. */
export function assertAuthEntitySchema(
	entities: readonly Pick<
		EntityMetadata,
		"tableName" | "className" | "properties"
	>[],
	options: HackKitAuthOptions,
): void {
	for (const table of Object.values(getAuthTables(options))) {
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
			if (!(property in entity.properties))
				throw new Error(
					`Better Auth field '${table.modelName}.${property}' needs a native MikroORM property and a reviewed migration.`,
				);
		}
	}
}

const profileSubscriber = {
	beforeFlush({ em, uow }: FlushEventArgs) {
		for (const user of uow.getPersistStack()) {
			if (
				!(user instanceof AuthUser.class) ||
				uow.getOriginalEntityData(user)
			)
				continue;
			const [firstName = "", ...lastName] = user.name.trim().split(/\s+/);
			em.create(HackKitProfile, {
				authId: user.id,
				firstName,
				lastName: lastName.join(" "),
				profilePhotoUrl: user.image ?? null,
			});
		}
	},
};

/** The application supplies credentials and providers; Core owns the database adapter. */
export function createHackKitAuth<const TOptions extends HackKitAuthOptions>(
	orm: MikroORM,
	options: TOptions,
) {
	assertAuthEntitySchema([...orm.getMetadata().getAll().values()], options);
	// Better Auth's create.after hooks run after commit. Create the profile in the
	// same MikroORM flush instead, so identity and profile always commit together.
	const events = orm.em.getEventManager();
	if (!events.getSubscribers().has(profileSubscriber))
		events.registerSubscriber(profileSubscriber);
	return betterAuth({
		...options,
		database: mikroOrmAdapter(orm),
	});
}
