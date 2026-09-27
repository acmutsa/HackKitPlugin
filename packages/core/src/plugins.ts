import type { EntityManager, EntitySchema } from "@mikro-orm/core";
import { authEntities } from "./mikro/auth-entities.js";
import { HackKitError } from "./errors.js";
import { coreModels } from "./models.js";
import type { NotificationsApi } from "./notifications.js";
import { CorePermission } from "./permissions.js";
import type {
	HackathonSettingDefinition,
	SettingKey,
	SettingValue,
} from "./settings.js";
import { coreSettings } from "./settings.js";
import type { PermissionKey } from "./types.js";
import type { HackkitGroup } from "./groups.js";

type PermissionMap = Record<string, PermissionKey>;

export type HackKitPluginContext = {
	em: EntityManager;
	actorAuthId?: string;
	getUser: (authId: string) => Promise<import("./types.js").User | null>;
	registry: HackKitRegistry;
	getSettingValue: (key: SettingKey) => Promise<SettingValue>;
	notifications: NotificationsApi;
	groups: readonly HackkitGroup[];
};

export type HackKitPlugin<
	TId extends string = string,
	TApi extends object = object,
> = {
	id: TId;
	/** npm package name used by HackKit CLI to resolve routes and actions. */
	packageName?: string;
	/** Factory exported by the plugin package, e.g. createTeamsActions. */
	actionFactory?: string;
	/** Server action names exposed by the plugin action factory. */
	actionNames?: readonly string[];
	entities?: readonly EntitySchema[];
	permissions?: PermissionMap;
	settings?: readonly HackathonSettingDefinition[];
	setup?: (context: HackKitPluginContext) => TApi;
};

export type PluginApiMap<TPlugins extends readonly HackKitPlugin[]> = {
	[Plugin in TPlugins[number] as Plugin["id"]]: Plugin extends HackKitPlugin<
		Plugin["id"],
		infer TApi
	>
		? TApi
		: Record<string, never>;
};

export type HackKitRegistry = {
	entities: EntitySchema[];
	permissions: Record<string, PermissionKey>;
	plugins: Record<string, HackKitPlugin>;
	settings: readonly HackathonSettingDefinition[];
};

export function createPluginRegistry(
	plugins: readonly HackKitPlugin[] = [],
	entities: readonly EntitySchema[] = [],
): HackKitRegistry {
	const registry: HackKitRegistry = {
		entities: [...authEntities, ...Object.values(coreModels)],
		permissions: { ...CorePermission },
		plugins: {},
		settings: [...coreSettings],
	};

	for (const plugin of plugins) {
		if (registry.plugins[plugin.id]) {
			throw new HackKitError(
				"CONFLICT",
				`HackKit plugin '${plugin.id}' is already registered.`,
			);
		}

		registry.plugins[plugin.id] = plugin;

		for (const entity of plugin.entities ?? []) {
			const prefix = `${plugin.id.replaceAll("-", "_")}_`;
			if (!entity.meta.tableName?.startsWith(prefix)) {
				throw new HackKitError(
					"INVALID_OPERATION",
					`Plugin entity '${entity.meta.className}' must use the '${prefix}' table namespace.`,
				);
			}
			registry.entities.push(entity);
		}

		for (const setting of plugin.settings ?? []) {
			if (!setting.key.startsWith(`${plugin.id}.`)) {
				throw new HackKitError(
					"INVALID_OPERATION",
					`Plugin setting '${setting.key}' must use the '${plugin.id}.' namespace.`,
				);
			}
			if (
				registry.settings.some(
					(existing) => existing.key === setting.key,
				)
			) {
				throw new HackKitError(
					"CONFLICT",
					`HackKit setting '${setting.key}' is already registered.`,
				);
			}
			registry.settings = [...registry.settings, setting];
		}

		for (const [name, permission] of Object.entries(
			plugin.permissions ?? {},
		)) {
			if (!permission.startsWith(`${plugin.id}.`)) {
				throw new HackKitError(
					"INVALID_OPERATION",
					`Plugin permission '${name}' must use the '${plugin.id}.' namespace.`,
				);
			}
			if (Object.values(registry.permissions).includes(permission)) {
				throw new HackKitError(
					"CONFLICT",
					`HackKit permission '${permission}' is already registered.`,
				);
			}
			registry.permissions[`${plugin.id}.${name}`] = permission;
		}
	}

	registry.entities.push(...entities);
	const names = new Set<string>();
	const tables = new Set<string>();
	for (const entity of registry.entities) {
		const name = entity.meta.className;
		const table = entity.meta.tableName;
		if (!table)
			throw new HackKitError(
				"INVALID_OPERATION",
				`Entity '${name}' must declare a tableName.`,
			);
		if (names.has(name) || tables.has(table))
			throw new HackKitError(
				"CONFLICT",
				`Duplicate entity name or table: '${name}' / '${table}'.`,
			);
		names.add(name);
		tables.add(table);
	}
	return registry;
}

export function setupPluginApis<TPlugins extends readonly HackKitPlugin[]>(
	plugins: TPlugins,
	context: HackKitPluginContext,
): PluginApiMap<TPlugins> {
	const apis: Record<string, object> = {};
	for (const plugin of plugins) {
		apis[plugin.id] = plugin.setup?.(context) ?? {};
	}
	return apis as PluginApiMap<TPlugins>;
}
