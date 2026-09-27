import type { EntityManager } from "@mikro-orm/core";
import { coreModels } from "./models.js";
import type { PermissionKey } from "./types.js";

export type SeedRoleInput = {
	id: string;
	name: string;
	position: number;
	permissions: PermissionKey[];
	color?: string;
};

export type SeedRolesOptions = {
	em: EntityManager;
	roles: readonly SeedRoleInput[];
	clock?: () => Date;
};

export type SeedRolesResult = {
	insertedRoleIds: string[];
	skippedRoleIds: string[];
};

export async function seedRoles(
	options: SeedRolesOptions,
): Promise<SeedRolesResult> {
	const now = options.clock ?? (() => new Date());

	const em = options.em;
	const insertedRoleIds: string[] = [];
	const skippedRoleIds: string[] = [];

	for (const role of options.roles) {
		const existing = await em.findOne(coreModels.role, {
			id: role.id,
		});
		if (existing) {
			skippedRoleIds.push(role.id);
			continue;
		}

		const timestamp = now();
		em.create(coreModels.role, {
			...role,
			createdAt: timestamp,
			updatedAt: timestamp,
		});
		await em.flush();
		insertedRoleIds.push(role.id);
	}

	return { insertedRoleIds, skippedRoleIds };
}
