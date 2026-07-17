import {
	isDatabaseAdapterFactory,
	type DatabaseAdapterInput,
} from "./database";
import { coreModels } from "./models";
import { createPluginRegistry, type HackKitPlugin } from "./plugins";
import type { PermissionKey } from "./types";

export type SeedRoleInput = {
	id: string;
	name: string;
	position: number;
	permissions: PermissionKey[];
	color?: string;
};

export type SeedRolesOptions = {
	database: DatabaseAdapterInput;
	plugins?: readonly HackKitPlugin[];
	roles: readonly SeedRoleInput[];
	clock?: () => Date;
	id?: () => string;
};

export type SeedRolesResult = {
	insertedRoleIds: string[];
	skippedRoleIds: string[];
};

const defaultId = () =>
	globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

export async function seedRoles(
	options: SeedRolesOptions,
): Promise<SeedRolesResult> {
	const now = options.clock ?? (() => new Date());
	const registry = createPluginRegistry(options.plugins ?? []);
	const database = isDatabaseAdapterFactory(options.database)
		? options.database.create({
				storage: registry.storage,
				now,
				id: options.id ?? defaultId,
			})
		: options.database;
	const insertedRoleIds: string[] = [];
	const skippedRoleIds: string[] = [];

	for (const role of options.roles) {
		const existing = await database.findOne(coreModels.role, {
			id: role.id,
		});
		if (existing) {
			skippedRoleIds.push(role.id);
			continue;
		}

		const timestamp = now();
		await database.insert(coreModels.role, {
			...role,
			createdAt: timestamp,
			updatedAt: timestamp,
		});
		insertedRoleIds.push(role.id);
	}

	return { insertedRoleIds, skippedRoleIds };
}
