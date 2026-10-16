import {
	operation,
	promiseApi,
	promiseFunction,
	type BoundaryError,
	fromResult,
} from "./effect";
import { decodeInput } from "./effect-schema";

import { Effect } from "effect";

import { serialize, type EntityManager } from "@mikro-orm/core";
import { withOperationLockEffect } from "./mikro/operation";

import { readUser } from "./mikro/user";
import { createAccessControlEffects } from "./access-control";
import { HackKitError } from "./errors";
import { type HackkitRuntimeContext } from "./hackkit-context";
import { coreModels } from "./models";
import { CorePermission } from "./permissions";
import {
	createPluginRegistry,
	setupPluginApis,
	type HackKitPlugin,
	type PluginApiMap,
} from "./plugins";
import {
	assignRoleSchema,
	createRoleSchema,
	deleteRoleSchema,
	registerHackerSchema,
	updateRoleSchema,
} from "./schemas";
import {
	type AuthId,
	type Hacker,
	type PermissionKey,
	type Role,
	type RoleId,
	type User,
	type UserData,
	type UserId,
} from "./types";
import { createUsersEffects } from "./functions/users";
import { createEventsEffects } from "./functions/events";
import { createSettingsEffects, settingsToPromise } from "./functions/settings";
import { createAdminEffects } from "./functions/admin";
import { createCompetitorRegistrationPolicy } from "./functions/registration-policy";
import {
	createCompleteUserDataSchema,
	resolveUserDataOptions,
	type UserDataOptionsInput,
} from "./user-data-options";
import { resolveEventTypes, type EventTypesInput } from "./event-types";
import { resolveGroups, type GroupsInput } from "./groups";
import { createLogger, type HackKitLoggerOptions } from "./adapters/logger";
import { withDomainLogEffect } from "./domain-log";
import { createNotificationsEffects } from "./notifications";
import { createRsvpEffects } from "./functions/rsvp";
import { createGroupsEffects } from "./functions/groups";
export type CreateHackkitOptions<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	em: EntityManager;
	registry?: import("./plugins").HackKitRegistry;
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
export function createHackkitEffects<
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
	const notificationsEffects = createNotificationsEffects({ em, now });
	const notificationsApi = promiseApi(notificationsEffects);
	function getUserOrThrow(
		authId: AuthId,
	): Effect.Effect<User, BoundaryError> {
		return Effect.gen(function* () {
			const user = yield* fromResult(readUser(em, { id: authId }));
			if (!user)
				return yield* Effect.fail(
					new HackKitError("NOT_FOUND", "User not found."),
				);
			return user;
		});
	}
	function getRoleOrThrow(
		roleId: RoleId,
	): Effect.Effect<Role, BoundaryError> {
		return Effect.gen(function* () {
			const role = yield* fromResult(
				em.findOne(coreModels.role, { id: roleId }),
			);
			if (!role)
				return yield* Effect.fail(
					new HackKitError("NOT_FOUND", "Role not found."),
				);
			return serialize(role);
		});
	}
	const accessControlEffects = createAccessControlEffects({
		getUserOrThrow: promiseFunction(getUserOrThrow),
		getRoleOrThrow: promiseFunction(getRoleOrThrow),
	});
	const accessControl = promiseApi(accessControlEffects);
	const settingsEffects = createSettingsEffects({
		em,
		now,
		logger,
		settings: registry.settings,
		requirePermission: accessControl.requirePermission,
	});
	const settingsApi = settingsToPromise(settingsEffects);
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
		getUserOrThrow: promiseFunction(getUserOrThrow),
		getRoleOrThrow: promiseFunction(getRoleOrThrow),
		requirePermission: accessControl.requirePermission,
		assertCanManageRole: accessControl.assertCanManageRole,
		accessControl,
		notifications: notificationsApi,
	};
	const registrationPolicy =
		createCompetitorRegistrationPolicy(runtimeContext);
	const rsvpApi = createRsvpEffects(runtimeContext);
	const groupsEffects = createGroupsEffects(runtimeContext);
	const groupsApi = promiseApi(groupsEffects);
	function registerHacker(
		input: unknown,
	): Effect.Effect<Hacker, BoundaryError> {
		return Effect.suspend(() =>
			withOperationLockEffect(em, "registration", () =>
				Effect.gen(function* () {
					const parsed = yield* decodeInput(
						registerHackerSchema,
						input,
					);
					return yield* withDomainLogEffect(
						logger,
						"hackers.register",
						{ targetAuthId: parsed.userId },
						() =>
							Effect.gen(function* () {
								yield* getUserOrThrow(parsed.userId);
								const userData = yield* fromResult(
									em.findOne(coreModels.userData, {
										authId: parsed.userId,
									}),
								);
								if (!userData)
									return yield* Effect.fail(
										new HackKitError(
											"INVALID_OPERATION",
											"User Data must be completed before registering as a Hacker.",
										),
									);
								const existing = yield* fromResult(
									em.findOne(coreModels.hacker, {
										userId: parsed.userId,
									}),
								);
								const timestamp = now();
								const value: Hacker = {
									...parsed,
									registeredAt:
										existing?.registeredAt ?? timestamp,
									updatedAt: timestamp,
								};
								if (existing) {
									em.assign(existing, value, {
										ignoreUndefined: true,
									});
									yield* fromResult(em.flush());
									return serialize(existing);
								}
								const { requireApproval } = yield* fromResult(
									registrationPolicy.assertCanRegisterNewHacker(),
								);
								const hacker = em.create(
									coreModels.hacker,
									value,
								);
								const profile = yield* fromResult(
									em.findOneOrFail(coreModels.user, {
										id: parsed.userId,
									}),
								);
								if (defaultCompetitorRoleId) {
									yield* getRoleOrThrow(
										defaultCompetitorRoleId,
									);
									profile.roleId = defaultCompetitorRoleId;
									profile.isApproved = !requireApproval;
								} else if (!requireApproval) {
									profile.isApproved = true;
								}
								profile.updatedAt = timestamp;
								yield* fromResult(em.flush());
								return serialize(hacker);
							}),
					);
				}),
			),
		);
	}
	const hackkit = {
		models: coreModels,
		permissions: CorePermission,
		registry,
		plugins: pluginApis,
		isPluginEnabled(pluginId: string): boolean {
			const plugin = registry.plugins[pluginId];
			return (
				Object.hasOwn(registry.plugins, pluginId) &&
				plugin.enabled !== false
			);
		},
		accessControl: accessControlEffects,
		settings: settingsEffects,
		notifications: notificationsEffects,
		users: createUsersEffects({
			...runtimeContext,
			registrationPolicy,
			groups: groupsApi,
		}),
		rsvp: rsvpApi,
		groups: groupsEffects,
		events: createEventsEffects(runtimeContext),
		admin: createAdminEffects(runtimeContext),
		userData: {
			options: userDataOptions,
			getUserData(
				authId: AuthId,
			): Effect.Effect<UserData | null, BoundaryError> {
				return Effect.gen(function* () {
					const record = yield* fromResult(
						em.findOne(coreModels.userData, {
							authId,
						}),
					);
					return record ? serialize(record) : null;
				});
			},
			completeUserData(
				input: unknown,
			): Effect.Effect<UserData, BoundaryError> {
				return Effect.suspend(() =>
					withOperationLockEffect(em, "user-data", () =>
						Effect.gen(function* () {
							const parsed = yield* decodeInput(
								completeUserDataSchema,
								input,
							);
							yield* getUserOrThrow(parsed.authId);
							const existing = yield* fromResult(
								em.findOne(coreModels.userData, {
									authId: parsed.authId,
								}),
							);
							const timestamp = now();
							const value: UserData = {
								...parsed,
								completedAt: existing?.completedAt ?? timestamp,
								updatedAt: timestamp,
							};
							const record = existing
								? em.assign(existing, value, {
										ignoreUndefined: true,
									})
								: em.create(coreModels.userData, value);
							yield* fromResult(em.flush());
							return serialize(record);
						}),
					),
				);
			},
		},
		hackers: {
			registerHacker,
			getHacker(
				userId: UserId,
			): Effect.Effect<Hacker | null, BoundaryError> {
				return Effect.gen(function* () {
					const record = yield* fromResult(
						em.findOne(coreModels.hacker, { userId }),
					);
					return record ? serialize(record) : null;
				});
			},
		},
		roles: {
			listRoles(input?: {
				actorAuthId?: AuthId;
			}): Effect.Effect<Role[], BoundaryError> {
				return Effect.gen(function* () {
					if (input?.actorAuthId)
						yield* fromResult(
							accessControl.requirePermission(
								input.actorAuthId,
								CorePermission.RolesView,
							),
						);
					return serialize(
						yield* fromResult(
							em.find(
								coreModels.role,
								{},
								{ orderBy: { position: "asc" } },
							),
						),
					);
				});
			},
			getRole(roleId: RoleId): Effect.Effect<Role | null, BoundaryError> {
				return Effect.gen(function* () {
					const record = yield* fromResult(
						em.findOne(coreModels.role, {
							id: roleId,
						}),
					);
					return record ? serialize(record) : null;
				});
			},
			createRole(input: unknown): Effect.Effect<Role, BoundaryError> {
				return Effect.suspend(() =>
					withOperationLockEffect(em, "roles", () =>
						Effect.gen(function* () {
							const parsed = yield* decodeInput(
								createRoleSchema,
								input,
							);
							const principal = yield* fromResult(
								accessControl.requirePermission(
									parsed.actorAuthId,
									CorePermission.RolesCreate,
								),
							);
							const rolePosition = {
								...principal.role,
								position: parsed.position,
							};
							yield* operation(() =>
								accessControl.assertCanManageRole(
									principal,
									rolePosition,
								),
							);
							yield* operation(() =>
								accessControl.assertCanGrantPermissions(
									principal,
									parsed.permissions as PermissionKey[],
								),
							);
							const existingName = yield* fromResult(
								em.findOne(coreModels.role, {
									name: parsed.name,
								}),
							);
							if (existingName)
								return yield* Effect.fail(
									new HackKitError(
										"CONFLICT",
										"Role name already exists.",
									),
								);
							const timestamp = now();
							{
								const created = em.create(coreModels.role, {
									id: parsed.id ?? id(),
									name: parsed.name,
									position: parsed.position,
									permissions:
										parsed.permissions as PermissionKey[],
									color: parsed.color,
									createdAt: timestamp,
									updatedAt: timestamp,
								});
								yield* fromResult(em.flush());
								return serialize(created);
							}
						}),
					),
				);
			},
			updateRole(input: unknown): Effect.Effect<Role, BoundaryError> {
				return Effect.suspend(() =>
					withOperationLockEffect(em, "roles", () =>
						Effect.gen(function* () {
							const parsed = yield* decodeInput(
								updateRoleSchema,
								input,
							);
							const principal = yield* fromResult(
								accessControl.requirePermission(
									parsed.actorAuthId,
									CorePermission.RolesUpdate,
								),
							);
							const role = yield* getRoleOrThrow(parsed.roleId);
							yield* operation(() =>
								accessControl.assertCanManageRole(
									principal,
									role,
								),
							);
							const position = parsed.position;
							if (position !== undefined)
								yield* operation(() =>
									accessControl.assertCanManageRole(
										principal,
										{
											...role,
											position,
										},
									),
								);
							if (parsed.permissions)
								yield* operation(() =>
									accessControl.assertCanGrantPermissions(
										principal,
										parsed.permissions as PermissionKey[],
									),
								);
							const updated = yield* fromResult(
								em.findOne(coreModels.role, {
									id: parsed.roleId,
								}),
							);
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
								yield* fromResult(em.flush());
							}
							if (!updated)
								return yield* Effect.fail(
									new HackKitError(
										"NOT_FOUND",
										"Role not found.",
									),
								);
							return serialize(updated);
						}),
					),
				);
			},
			deleteRole(input: unknown): Effect.Effect<void, BoundaryError> {
				return Effect.suspend(() =>
					withOperationLockEffect(em, "roles", () =>
						Effect.gen(function* () {
							const parsed = yield* decodeInput(
								deleteRoleSchema,
								input,
							);
							const principal = yield* fromResult(
								accessControl.requirePermission(
									parsed.actorAuthId,
									CorePermission.RolesDelete,
								),
							);
							const role = yield* getRoleOrThrow(parsed.roleId);
							yield* operation(() =>
								accessControl.assertCanManageRole(
									principal,
									role,
								),
							);
							const usersWithRole = yield* fromResult(
								em.find(
									coreModels.user,
									{ roleId: parsed.roleId },
									{ limit: 1 },
								),
							);
							if (usersWithRole.length > 0)
								return yield* Effect.fail(
									new HackKitError(
										"INVALID_OPERATION",
										"Cannot delete a role assigned to users.",
									),
								);
							yield* fromResult(
								em.nativeDelete(coreModels.role, {
									id: parsed.roleId,
								}),
							);
						}),
					),
				);
			},
			assignRoleToUser(
				input: unknown,
			): Effect.Effect<User, BoundaryError> {
				return Effect.suspend(() =>
					withOperationLockEffect(em, "roles", () =>
						Effect.gen(function* () {
							const parsed = yield* decodeInput(
								assignRoleSchema,
								input,
							);
							const principal = yield* fromResult(
								accessControl.requirePermission(
									parsed.actorAuthId,
									CorePermission.RolesAssign,
								),
							);
							const target = yield* getUserOrThrow(
								parsed.targetAuthId,
							);
							const nextRole = yield* getRoleOrThrow(
								parsed.roleId,
							);
							yield* operation(() =>
								accessControl.assertCanManageRole(
									principal,
									nextRole,
								),
							);
							if (target.roleId)
								yield* operation(
									accessControl.assertCanManageRole.bind(
										accessControl,
										principal,
										yield* getRoleOrThrow(target.roleId),
									),
								);
							const updated = yield* fromResult(
								em.findOne(coreModels.user, {
									id: parsed.targetAuthId,
								}),
							);
							if (updated) {
								em.assign(
									updated,
									{
										roleId: parsed.roleId,
										updatedAt: now(),
									},
									{ ignoreUndefined: true },
								);
								yield* fromResult(em.flush());
							}
							if (!updated)
								return yield* Effect.fail(
									new HackKitError(
										"NOT_FOUND",
										"User not found.",
									),
								);
							return yield* getUserOrThrow(parsed.targetAuthId);
						}),
					),
				);
			},
		},
	};
	return hackkit as typeof hackkit & {
		plugins: PluginApiMap<TPlugins>;
	};
}
export type HackKit = ReturnType<typeof createHackkit>;
export function createHackkit<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(options: CreateHackkitOptions<TPlugins>) {
	const effects = createHackkitEffects(options);
	return {
		...effects,
		accessControl: promiseApi(effects.accessControl),
		settings: settingsToPromise(effects.settings),
		notifications: promiseApi(effects.notifications),
		groups: promiseApi(effects.groups),
		userData: promiseApi(effects.userData),
		hackers: promiseApi(effects.hackers),
		roles: promiseApi(effects.roles),
		users: promiseApi(effects.users),
		events: promiseApi(effects.events),
		admin: promiseApi(effects.admin),
		rsvp: promiseApi(effects.rsvp),
	};
}
