import type { HackKitLogger } from "./adapters/logger.js";
import type { EntityManager } from "@mikro-orm/core";
import type { EventTypes } from "./event-types.js";
import type { SettingKey, SettingValue } from "./settings.js";
import type { UserDataOptions } from "./user-data-options.js";
import type { AccessControl, AccessPrincipal } from "./access-control.js";
import type { NotificationsApi } from "./notifications.js";
import type { AuthId, PermissionKey, Role, User } from "./types.js";
import type { HackkitGroup } from "./groups.js";

export type HackkitRuntimeContext = {
	em: EntityManager;
	now: () => Date;
	id: () => string;
	logger: HackKitLogger;
	defaultCompetitorRoleId?: string;
	getSettingValue: (key: SettingKey) => Promise<SettingValue>;
	eventTypes: EventTypes;
	userDataOptions: UserDataOptions;
	groups: readonly HackkitGroup[];
	getUserOrThrow: (authId: AuthId) => Promise<User>;
	getRoleOrThrow: (roleId: string) => Promise<Role>;
	requirePermission: (
		actorAuthId: AuthId,
		permission: PermissionKey,
	) => Promise<AccessPrincipal>;
	assertCanManageRole: (principal: AccessPrincipal, role: Role) => void;
	accessControl: AccessControl;
	notifications: NotificationsApi;
};
