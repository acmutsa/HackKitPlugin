import { promiseApi, type BoundaryError } from "@hackkit/core/effect";
import { Cause, Effect } from "effect";
import { runPromise, fromResult, originalError } from "@hackkit/core/effect";
import {
	type Hacker,
	type HackKit,
	type PermissionKey,
	type SettingKey,
	type SettingValue,
	type User,
	type UserBan,
	type UserData,
	CoreSetting,
	HackKitError,
	type AccessPrincipal,
} from "@hackkit/core";

import { notFound, redirect } from "next/navigation";
export type PageGuardOptions = {
	onForbidden?: "notFound" | "redirect" | ((error: HackKitError) => never);
	redirectTo?: string;
	approvalRedirectTo?: string;
	onboardingRedirectTo?: string;
	registrationClosedRedirectTo?: string;
	suspendedRedirectTo?: string;
	getCurrentUser?: () => Promise<User>;
	getSettingValue?: (key: SettingKey) => Promise<SettingValue>;
};
export type CompetitorOnboardingState = {
	user: User;
	userData: UserData;
	hacker: Hacker;
};
export function createPageGuardEffects(
	hackkit: HackKit,
	getAuthId: () => Promise<string>,
	options: PageGuardOptions = {},
) {
	const onForbidden = options.onForbidden ?? "notFound";
	const redirectTo = options.redirectTo ?? "/dashboard";
	const approvalRedirectTo = options.approvalRedirectTo ?? "/i/approval";
	const onboardingRedirectTo =
		options.onboardingRedirectTo ?? "/onboarding/hacktag";
	const registrationClosedRedirectTo =
		options.registrationClosedRedirectTo ?? "/registration-closed";
	const suspendedRedirectTo = options.suspendedRedirectTo ?? "/suspended";
	function handleForbidden(error: unknown): never {
		if (error instanceof HackKitError && error.code === "FORBIDDEN") {
			if (onForbidden === "notFound") notFound();
			if (onForbidden === "redirect") redirect(redirectTo);
			if (typeof onForbidden === "function") onForbidden(error);
		}
		throw error;
	}
	function getCurrentUser(): Effect.Effect<User, BoundaryError> {
		return Effect.gen(function* () {
			if (options.getCurrentUser)
				return yield* fromResult(options.getCurrentUser());
			const authId = yield* fromResult(getAuthId());
			const user = yield* fromResult(hackkit.users.getUser(authId));
			if (user) return user;
			handleForbidden(new HackKitError("FORBIDDEN", "User is required."));
		});
	}
	function getSettingValue(
		key: SettingKey,
	): Effect.Effect<SettingValue, BoundaryError> {
		return Effect.suspend(() =>
			fromResult(
				options.getSettingValue
					? options.getSettingValue(key)
					: hackkit.settings.getValue(key),
			),
		);
	}
	function requireNotBannedForAuthId(
		authId: string,
	): Effect.Effect<UserBan | null, BoundaryError> {
		return Effect.gen(function* () {
			const ban = yield* fromResult(hackkit.users.getUserBan(authId));
			if (ban) redirect(suspendedRedirectTo);
			return null;
		});
	}
	function requireNotBanned(): Effect.Effect<UserBan | null, BoundaryError> {
		return Effect.gen(function* () {
			return yield* fromResult(
				requireNotBannedForAuthId(yield* fromResult(getAuthId())),
			);
		});
	}
	function requireApprovedUser(): Effect.Effect<User, BoundaryError> {
		return Effect.gen(function* () {
			const user = yield* fromResult(getCurrentUser());
			yield* fromResult(requireNotBannedForAuthId(user.id));
			if (!user.isApproved) redirect(approvalRedirectTo);
			return user;
		});
	}
	function requireCompletedOnboarding(): Effect.Effect<
		CompetitorOnboardingState,
		BoundaryError
	> {
		return Effect.gen(function* () {
			const user = yield* fromResult(getCurrentUser());
			yield* fromResult(requireNotBannedForAuthId(user.id));
			if (!user.hackTag) redirect(onboardingRedirectTo);
			const [userData, hacker] = yield* Effect.all(
				[
					fromResult(hackkit.userData.getUserData(user.id)),
					fromResult(hackkit.hackers.getHacker(user.id)),
				],
				{ concurrency: "unbounded" },
			);
			if (!userData) redirect("/onboarding/user-data");
			if (!hacker) {
				const registrationOpen = yield* fromResult(
					getSettingValue(CoreSetting.RegistrationOpen),
				);
				if (!registrationOpen) redirect(registrationClosedRedirectTo);
				redirect("/onboarding/hacker");
			}
			return { user, userData, hacker };
		});
	}
	function requireParticipantAccess(): Effect.Effect<
		CompetitorOnboardingState,
		BoundaryError
	> {
		return Effect.gen(function* () {
			const state = yield* fromResult(requireCompletedOnboarding());
			if (!state.user.isApproved) redirect(approvalRedirectTo);
			return state;
		});
	}
	function requireOnboardingAccess(): Effect.Effect<User, BoundaryError> {
		return Effect.gen(function* () {
			const user = yield* fromResult(getCurrentUser());
			yield* fromResult(requireNotBannedForAuthId(user.id));
			if (!user.hackTag) return user;
			const [userData, hacker] = yield* Effect.all(
				[
					fromResult(hackkit.userData.getUserData(user.id)),
					fromResult(hackkit.hackers.getHacker(user.id)),
				],
				{ concurrency: "unbounded" },
			);
			if (!userData || !hacker) return user;
			if (!user.isApproved) redirect(approvalRedirectTo);
			redirect(redirectTo);
		});
	}
	function requireApprovalPendingAccess(): Effect.Effect<
		CompetitorOnboardingState,
		BoundaryError
	> {
		return Effect.gen(function* () {
			const state = yield* fromResult(requireCompletedOnboarding());
			if (state.user.isApproved) redirect(redirectTo);
			return state;
		});
	}
	return {
		requirePermission(
			permission: PermissionKey,
		): Effect.Effect<AccessPrincipal, BoundaryError> {
			return Effect.gen(function* () {
				const authId = yield* fromResult(getAuthId());
				yield* fromResult(requireNotBannedForAuthId(authId));
				return yield* fromResult(
					hackkit.accessControl.requirePermission(authId, permission),
				);
			}).pipe(
				Effect.catchAllCause((cause) =>
					Effect.sync(() =>
						handleForbidden(originalError(Cause.squash(cause))),
					),
				),
			);
		},
		requireHackerRegistrationOpenForNewHacker(): Effect.Effect<
			void,
			BoundaryError
		> {
			return Effect.gen(function* () {
				const authId = yield* fromResult(getAuthId());
				const existing = yield* fromResult(
					hackkit.hackers.getHacker(authId),
				);
				if (existing) return;
				const registrationOpen = yield* fromResult(
					getSettingValue(CoreSetting.RegistrationOpen),
				);
				if (registrationOpen) return;
				redirect(registrationClosedRedirectTo);
			});
		},
		requireNotBanned,
		requireApprovedUser,
		requireCompletedOnboarding,
		requireParticipantAccess,
		requireOnboardingAccess,
		requireApprovalPendingAccess,
		getOptionalPermission(
			permission: PermissionKey,
		): Effect.Effect<AccessPrincipal | null, BoundaryError> {
			return Effect.gen(function* () {
				const authId = yield* fromResult(getAuthId());
				yield* fromResult(requireNotBannedForAuthId(authId));
				const allowed = yield* fromResult(
					hackkit.accessControl.hasPermission(authId, permission),
				);
				if (!allowed) return null;
				return yield* fromResult(
					hackkit.accessControl.getPrincipal(authId),
				);
			});
		},
	};
}
export type PageGuards = ReturnType<typeof createPageGuards>;

export function createPageGuards(
	hackkit: HackKit,
	getAuthId: () => Promise<string>,
	options: PageGuardOptions = {},
) {
	return promiseApi(createPageGuardEffects(hackkit, getAuthId, options));
}
