import "server-only";

import {
	CorePermission,
	CoreSetting,
	type PermissionKey,
	type SettingKey,
} from "@hackkit/core";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "./auth";

export async function hackkitHeaders() {
	return headers();
}

export async function getCurrentHackkitUser() {
	return auth.api.getHackkitMe({ headers: await hackkitHeaders() });
}

export async function getHackkitSetting(key: SettingKey) {
	return (await auth.api.getHackkitSettingValue({ body: { key } })).value;
}

export async function requireHackkitPermission(permission: PermissionKey) {
	const requestHeaders = await hackkitHeaders();
	const [check, principal] = await Promise.all([
		auth.api.checkHackkitPermission({
			headers: requestHeaders,
			body: { permission },
		}),
		auth.api.getHackkitPrincipal({ headers: requestHeaders }),
	]);
	if (!check.allowed) notFound();
	return principal;
}

export async function requireNotBanned() {
	const ban = await auth.api.getHackkitBan({
		headers: await hackkitHeaders(),
	});
	if (ban) redirect("/suspended");
}

export async function requireApprovedUser() {
	const user = await getCurrentHackkitUser();
	await requireNotBanned();
	if (!user.isApproved) redirect("/i/approval");
	return user;
}

export async function requireCompletedOnboarding() {
	const requestHeaders = await hackkitHeaders();
	const user = await auth.api.getHackkitMe({ headers: requestHeaders });
	await requireNotBanned();
	if (!user.hackTag) redirect("/onboarding/hacktag");
	const [userData, hacker] = await Promise.all([
		auth.api.getHackkitUserData({ headers: requestHeaders }),
		auth.api.getHackkitHacker({ headers: requestHeaders }),
	]);
	if (!userData) redirect("/onboarding/user-data");
	if (!hacker) {
		if (!Boolean(await getHackkitSetting(CoreSetting.RegistrationOpen))) {
			redirect("/registration-closed");
		}
		redirect("/onboarding/hacker");
	}
	return { user, userData, hacker };
}

export async function requireParticipantAccess() {
	const state = await requireCompletedOnboarding();
	if (!state.user.isApproved) redirect("/i/approval");
	return state;
}

export async function requireOnboardingAccess() {
	const requestHeaders = await hackkitHeaders();
	const user = await auth.api.getHackkitMe({ headers: requestHeaders });
	await requireNotBanned();
	if (!user.hackTag) return user;
	const [userData, hacker] = await Promise.all([
		auth.api.getHackkitUserData({ headers: requestHeaders }),
		auth.api.getHackkitHacker({ headers: requestHeaders }),
	]);
	if (!userData || !hacker) return user;
	if (!user.isApproved) redirect("/i/approval");
	redirect("/dashboard");
}

export async function requireApprovalPendingAccess() {
	const state = await requireCompletedOnboarding();
	if (state.user.isApproved) redirect("/dashboard");
	return state;
}

export async function requireHackerRegistrationOpenForNewHacker() {
	const requestHeaders = await hackkitHeaders();
	const hacker = await auth.api.getHackkitHacker({ headers: requestHeaders });
	if (hacker) return;
	if (!Boolean(await getHackkitSetting(CoreSetting.RegistrationOpen))) {
		redirect("/registration-closed");
	}
}

export async function getOptionalHackkitPermission(permission: PermissionKey) {
	await requireNotBanned();
	const requestHeaders = await hackkitHeaders();
	const check = await auth.api.checkHackkitPermission({
		headers: requestHeaders,
		body: { permission },
	});
	if (!check.allowed) return null;
	return auth.api.getHackkitPrincipal({ headers: requestHeaders });
}

export async function requireHackkitAdmin() {
	await requireNotBanned();
	return requireHackkitPermission(CorePermission.Admin);
}
