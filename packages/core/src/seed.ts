import { Effect } from "effect";
import { runPromise, fromResult } from "./effect";
import { type EntityManager } from "@mikro-orm/core";
import { coreModels } from "./models";
import { type PermissionKey } from "./types";
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
export function seedRoles(options: SeedRolesOptions): Promise<SeedRolesResult> {
	return runPromise(
		Effect.gen(function* () {
			const now = options.clock ?? (() => new Date());
			const em = options.em;
			const insertedRoleIds: string[] = [];
			const skippedRoleIds: string[] = [];
			for (const role of options.roles) {
				const existing = yield* fromResult(
					em.findOne(coreModels.role, {
						id: role.id,
					}),
				);
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
				yield* fromResult(em.flush());
				insertedRoleIds.push(role.id);
			}
			return { insertedRoleIds, skippedRoleIds };
		}),
	);
}
