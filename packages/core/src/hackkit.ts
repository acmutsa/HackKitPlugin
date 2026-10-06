import { serialize } from "@mikro-orm/core";
import { withOperationLock } from "./mikro/operation.js";
import type { EntityManager } from "@mikro-orm/core";
import { readUser } from "./mikro/user.js";
import { createAccessControl } from "./access-control.js";
import { HackKitError, parseInput } from "./errors.js";
import type { HackkitRuntimeContext } from "./hackkit-context.js";
import { coreModels } from "./models.js";
import { CorePermission } from "./permissions.js";
import {
	createPluginRegistry,
	setupPluginApis,
	type HackKitPlugin,
	type PluginApiMap,
} from "./plugins.js";
import {
	assignRoleSchema,
	createRoleSchema,
	deleteRoleSchema,
	registerHackerSchema,
	updateRoleSchema,
} from "./schemas.js";
import type {
	AuthId,
	Hacker,
	PermissionKey,
	Role,
	RoleId,
	User,
	UserData,
} from "./types.js";
import { createUsersApi } from "./functions/users.js";
import { createEventsApi } from "./functions/events.js";
import { createSettingsApi } from "./functions/settings.js";
import { createAdminApi } from "./functions/admin.js";
import { createCompetitorRegistrationPolicy } from "./functions/registration-policy.js";
import {
	createCompleteUserDataSchema,
	resolveUserDataOptions,
	type UserDataOptionsInput,
} from "./user-data-options.js";
import { resolveEventTypes, type EventTypesInput } from "./event-types.js";
import { resolveGroups, type GroupsInput } from "./groups.js";
import { createLogger, type HackKitLoggerOptions } from "./adapters/logger.js";
import { withDomainLog } from "./domain-log.js";
import { createNotificationsApi } from "./notifications.js";
import { createRsvpApi } from "./functions/rsvp.js";
import { createGroupsApi } from "./functions/groups.js";

export type CreateHackkitOptions<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	em: EntityManager;
	registry?: import("./plugins.js").HackKitRegistry;
	actorAuthId?: string;
	plugins?: TPlugins;
	clock?: () => Date;
	id?: () => string;
	userDataOptions?: UserDataOptionsInput;
	eventTypes?: EventTypesInput;
	groups?: GroupsInput;
	logger?: HackKitLoggerOptions;
	defaultCompetitorRoleId?: string;
};

const defaultId = () =>
	globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function createHackkit<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(options: CreateHackkitOptions<TPlugins>) {
	const plugins = options.plugins ?? ([] as unknown as TPlugins);
	const registry = options.registry ?? createPluginRegistry(plugins);
	const now = options.clock ?? (() => new Date());
	const id = options.id ?? defaultId;
	const em = options.em;
	const userDataOptions = resolveUserDataOptions(options.userDataOptions);
	const eventTypes = resolveEventTypes(options.eventTypes);
	const groups = resolveGroups(options.groups);
	const completeUserDataSchema =
		createCompleteUserDataSchema(userDataOptions);
	const logger = createLogger(options.logger);
	const defaultCompetitorRoleId = options.defaultCompetitorRoleId;
	const notificationsApi = createNotificationsApi({ em, now });

	async function getUserOrThrow(authId: AuthId): Promise<User> {
		const user = await readUser(em, { id: authId });
		if (!user) throw new HackKitError("NOT_FOUND", "User not found.");
		return user;
	}

	async function getRoleOrThrow(roleId: RoleId): Promise<Role> {
		const role = await em.findOne(coreModels.role, { id: roleId });
		if (!role) throw new HackKitError("NOT_FOUND", "Role not found.");
		return serialize(role);
	}

	const accessControl = createAccessControl({
		getUserOrThrow,
		getRoleOrThrow,
	});
	const settingsApi = createSettingsApi({
		em,
		now,
		logger,
		settings: registry.settings,
		requirePermission: accessControl.requirePermission,
	});
	const pluginApis = setupPluginApis(plugins, {
		em,
		actorAuthId: options.actorAuthId,
		getUser: (authId) => readUser(em, { id: authId }),
		registry,
		getSettingValue: settingsApi.getValue,
		notifications: notificationsApi,
		groups,
	});

	const runtimeContext: HackkitRuntimeContext = {
		em,
		now,
		id,
		logger,
		defaultCompetitorRoleId,
		getSettingValue: settingsApi.getValue,
		eventTypes,
		userDataOptions,
		groups,
		getUserOrThrow,
		getRoleOrThrow,
		requirePermission: accessControl.requirePermission,
		assertCanManageRole: accessControl.assertCanManageRole,
		accessControl,
		notifications: notificationsApi,
	};

	const registrationPolicy =
		createCompetitorRegistrationPolicy(runtimeContext);
	const rsvpApi = createRsvpApi(runtimeContext);
	const groupsApi = createGroupsApi(runtimeContext);

	async function registerHacker(input: unknown): Promise<Hacker> {
		return withOperationLock(em, "registration", async () => {
			const parsed = parseInput(registerHackerSchema, input);
			return withDomainLog(
				logger,
				"hackers.register",
				{ targetAuthId: parsed.authId },
				async () => {
					await getUserOrThrow(parsed.authId);
					const userData = await em.findOne(coreModels.userData, {
						authId: parsed.authId,
					});
					if (!userData)
						throw new HackKitError(
							"INVALID_OPERATION",
							"User Data must be completed before registering as a Hacker.",
						);
					const existing = await em.findOne(coreModels.hacker, {
						authId: parsed.authId,
					});
					const timestamp = now();
					const value: Hacker = {
						...parsed,
						registeredAt: existing?.registeredAt ?? timestamp,
						updatedAt: timestamp,
					};

					if (existing) {
						em.assign(existing, value, { ignoreUndefined: true });
						await em.flush();
						return serialize(existing);
					}
					const { requireApproval } =
						await registrationPolicy.assertCanRegisterNewHacker();
					const hacker = em.create(coreModels.hacker, value);
					const profile = await em.findOneOrFail(coreModels.user, {
						id: parsed.authId,
					});
					if (defaultCompetitorRoleId) {
						await getRoleOrThrow(defaultCompetitorRoleId);
						profile.roleId = defaultCompetitorRoleId;
						profile.isApproved = !requireApproval;
					} else if (!requireApproval) {
						profile.isApproved = true;
					}
					profile.updatedAt = timestamp;
					await em.flush();
					return serialize(hacker);
				},
			);
		});
	}

	const hackkit = {
		models: coreModels,
		permissions: CorePermission,
		registry,
		plugins: pluginApis,
		isPluginEnabled(pluginId: string): boolean {
			const plugin = registry.plugins[pluginId];
			return Object.hasOwn(registry.plugins, pluginId) && plugin.enabled !== false;
		},
		accessControl,
		settings: settingsApi,
		notifications: notificationsApi,
		users: createUsersApi({
			...runtimeContext,
			registrationPolicy,
			groups: groupsApi,
		}),
		rsvp: rsvpApi,
		groups: groupsApi,
		events: createEventsApi(runtimeContext),
		admin: createAdminApi(runtimeContext),

		userData: {
			options: userDataOptions,

			async getUserData(authId: AuthId): Promise<UserData | null> {
				const record = await em.findOne(coreModels.userData, {
					authId,
				});
				return record ? serialize(record) : null;
			},

			async completeUserData(input: unknown): Promise<UserData> {
				return withOperationLock(em, "user-data", async () => {
					const parsed = parseInput(completeUserDataSchema, input);
					await getUserOrThrow(parsed.authId);
					const existing = await em.findOne(coreModels.userData, {
						authId: parsed.authId,
					});
					const timestamp = now();
					const value: UserData = {
						...parsed,
						completedAt: existing?.completedAt ?? timestamp,
						updatedAt: timestamp,
					};
					const record = existing
						? em.assign(existing, value, { ignoreUndefined: true })
						: em.create(coreModels.userData, value);
					await em.flush();
					return serialize(record);
				});
			},
		},

		hackers: {
			registerHacker,

			async getHacker(authId: AuthId): Promise<Hacker | null> {
				const record = await em.findOne(coreModels.hacker, { authId });
				return record ? serialize(record) : null;
			},
		},

		roles: {
			async listRoles(input?: { actorAuthId?: AuthId }): Promise<Role[]> {
				if (input?.actorAuthId)
					await accessControl.requirePermission(
						input.actorAuthId,
						CorePermission.RolesView,
					);
				return serialize(
					await em.find(
						coreModels.role,
						{},
						{ orderBy: { position: "asc" } },
					),
				);
			},

			async getRole(roleId: RoleId): Promise<Role | null> {
				const record = await em.findOne(coreModels.role, {
					id: roleId,
				});
				return record ? serialize(record) : null;
			},

			async createRole(input: unknown): Promise<Role> {
				return withOperationLock(em, "roles", async () => {
					const parsed = parseInput(createRoleSchema, input);
					const principal = await accessControl.requirePermission(
						parsed.actorAuthId,
						CorePermission.RolesCreate,
					);
					const rolePosition = {
						...principal.role,
						position: parsed.position,
					};
					accessControl.assertCanManageRole(principal, rolePosition);
					accessControl.assertCanGrantPermissions(
						principal,
						parsed.permissions as PermissionKey[],
					);
					const existingName = await em.findOne(coreModels.role, {
						name: parsed.name,
					});
					if (existingName)
						throw new HackKitError(
							"CONFLICT",
							"Role name already exists.",
						);
					const timestamp = now();
					{
						const created = em.create(coreModels.role, {
							id: parsed.id ?? id(),
							name: parsed.name,
							position: parsed.position,
							permissions: parsed.permissions as PermissionKey[],
							color: parsed.color,
							createdAt: timestamp,
							updatedAt: timestamp,
						});
						await em.flush();
						return serialize(created);
					}
				});
			},

			async updateRole(input: unknown): Promise<Role> {
				return withOperationLock(em, "roles", async () => {
					const parsed = parseInput(updateRoleSchema, input);
					const principal = await accessControl.requirePermission(
						parsed.actorAuthId,
						CorePermission.RolesUpdate,
					);
					const role = await getRoleOrThrow(parsed.roleId);
					accessControl.assertCanManageRole(principal, role);
					if (parsed.position !== undefined)
						accessControl.assertCanManageRole(principal, {
							...role,
							position: parsed.position,
						});
					if (parsed.permissions)
						accessControl.assertCanGrantPermissions(
							principal,
							parsed.permissions as PermissionKey[],
						);
					const updated = await em.findOne(coreModels.role, {
						id: parsed.roleId,
					});
					if (updated) {
						em.assign(
							updated,
							{
								name: parsed.name,
								position: parsed.position,
								permissions: parsed.permissions as
									| PermissionKey[]
									| undefined,
								color: parsed.color,
								updatedAt: now(),
							},
							{ ignoreUndefined: true },
						);
						await em.flush();
					}
					if (!updated)
						throw new HackKitError("NOT_FOUND", "Role not found.");
					return serialize(updated);
				});
			},

			async deleteRole(input: unknown): Promise<void> {
				return withOperationLock(em, "roles", async () => {
					const parsed = parseInput(deleteRoleSchema, input);
					const principal = await accessControl.requirePermission(
						parsed.actorAuthId,
						CorePermission.RolesDelete,
					);
					const role = await getRoleOrThrow(parsed.roleId);
					accessControl.assertCanManageRole(principal, role);
					const usersWithRole = await em.find(
						coreModels.user,
						{ roleId: parsed.roleId },
						{ limit: 1 },
					);
					if (usersWithRole.length > 0)
						throw new HackKitError(
							"INVALID_OPERATION",
							"Cannot delete a role assigned to users.",
						);
					await em.nativeDelete(coreModels.role, {
						id: parsed.roleId,
					});
				});
			},

			async assignRoleToUser(input: unknown): Promise<User> {
				return withOperationLock(em, "roles", async () => {
					const parsed = parseInput(assignRoleSchema, input);
					const principal = await accessControl.requirePermission(
						parsed.actorAuthId,
						CorePermission.RolesAssign,
					);
					const target = await getUserOrThrow(parsed.targetAuthId);
					const nextRole = await getRoleOrThrow(parsed.roleId);
					accessControl.assertCanManageRole(principal, nextRole);
					if (target.roleId)
						accessControl.assertCanManageRole(
							principal,
							await getRoleOrThrow(target.roleId),
						);
					const updated = await em.findOne(coreModels.user, {
						id: parsed.targetAuthId,
					});
					if (updated) {
						em.assign(
							updated,
							{
								roleId: parsed.roleId,
								updatedAt: now(),
							},
							{ ignoreUndefined: true },
						);
						await em.flush();
					}
					if (!updated)
						throw new HackKitError("NOT_FOUND", "User not found.");
					return getUserOrThrow(parsed.targetAuthId);
				});
			},
		},
	};

	return hackkit as typeof hackkit & { plugins: PluginApiMap<TPlugins> };
}

export type HackKit = ReturnType<typeof createHackkit>;
