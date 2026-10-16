import { promiseApi, type BoundaryError, fromResult } from "./effect";
import { Effect } from "effect";

import { HackKitError } from "./errors";
import { CorePermission, hasPermission, hasSuperAdmin } from "./permissions";
import { type AuthId, type PermissionKey, type Role, type User } from "./types";
export type AccessPrincipal = {
	user: User;
	role: Role;
};
export type AccessControlDeps = {
	getUserOrThrow: (authId: AuthId) => Promise<User>;
	getRoleOrThrow: (roleId: string) => Promise<Role>;
};
export function createAccessControlEffects(deps: AccessControlDeps) {
	const { getUserOrThrow, getRoleOrThrow } = deps;
	function getPrincipal(
		authId: AuthId,
	): Effect.Effect<AccessPrincipal, BoundaryError> {
		return Effect.gen(function* () {
			const user = yield* fromResult(getUserOrThrow(authId));
			if (!user.roleId) {
				return yield* Effect.fail(
					new HackKitError("FORBIDDEN", "User has no role."),
				);
			}
			return {
				user,
				role: yield* fromResult(getRoleOrThrow(user.roleId)),
			};
		});
	}
	function principalCanBypassHierarchy(principal: AccessPrincipal): boolean {
		return hasSuperAdmin(principal.role.permissions);
	}
	function principalOutranks(
		principal: AccessPrincipal,
		role: Role,
	): boolean {
		return (
			principalCanBypassHierarchy(principal) ||
			principal.role.position < role.position
		);
	}
	return {
		getPrincipal,
		requirePermission(
			authId: AuthId,
			permission: PermissionKey,
		): Effect.Effect<AccessPrincipal, BoundaryError> {
			return Effect.gen(function* () {
				const principal = yield* getPrincipal(authId);
				if (!hasPermission(principal.role.permissions, permission)) {
					return yield* Effect.fail(
						new HackKitError(
							"FORBIDDEN",
							"User does not have the required permission.",
						),
					);
				}
				return principal;
			});
		},
		hasPermission(
			authId: AuthId,
			permission: PermissionKey,
		): Effect.Effect<boolean, BoundaryError> {
			return Effect.gen(function* () {
				const user = yield* fromResult(getUserOrThrow(authId));
				if (!user.roleId) return false;
				const role = yield* fromResult(getRoleOrThrow(user.roleId));
				return hasPermission(role.permissions, permission);
			});
		},
		assertCanManageRole(principal: AccessPrincipal, role: Role): void {
			if (!principalOutranks(principal, role)) {
				throw new HackKitError(
					"FORBIDDEN",
					"User cannot manage a role at this position.",
				);
			}
		},
		assertCanGrantPermissions(
			principal: AccessPrincipal,
			permissions: PermissionKey[],
		): void {
			const includesSuperAdmin = permissions.includes(
				CorePermission.SuperAdmin,
			);
			if (
				includesSuperAdmin &&
				!hasSuperAdmin(principal.role.permissions)
			) {
				throw new HackKitError(
					"FORBIDDEN",
					"Only a super admin can grant or remove super admin permission.",
				);
			}
		},
	};
}
export type AccessControl = ReturnType<typeof createAccessControl>;
export function createAccessControl(deps: AccessControlDeps) {
	return promiseApi(createAccessControlEffects(deps));
}
