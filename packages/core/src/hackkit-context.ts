import type { HackKitLogger } from "./adapters/logger";
import type { EntityManager } from "@mikro-orm/core";
import type { EventTypes } from "./event-types";
import type { SettingKey, SettingValue } from "./settings";
import type { UserDataOptions } from "./user-data-options";
import type { AccessControl, AccessPrincipal } from "./access-control";
import type { NotificationsApi } from "./notifications";
import type { AuthId, PermissionKey, Role, User } from "./types";
import type { HackkitGroup } from "./groups";

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
