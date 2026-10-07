"use server";

// @hackkit-generated — do not edit

import { getRuntime } from "@/lib/runtime";
import { createTeamsActions } from "@hackkit/plugin-teams/actions";
import { createDiscordActions } from "@hackkit/plugin-discord/actions";

export async function createTeam(
	...args: Parameters<
		Awaited<ReturnType<typeof createTeamsActions>>["createTeam"]
	>
) {
	const actions = await createTeamsActions(await getRuntime());
	return actions.createTeam(...args);
}

export async function inviteToTeam(
	...args: Parameters<
		Awaited<ReturnType<typeof createTeamsActions>>["inviteToTeam"]
	>
) {
	const actions = await createTeamsActions(await getRuntime());
	return actions.inviteToTeam(...args);
}

export async function respondToInvite(
	...args: Parameters<
		Awaited<ReturnType<typeof createTeamsActions>>["respondToInvite"]
	>
) {
	const actions = await createTeamsActions(await getRuntime());
	return actions.respondToInvite(...args);
}

export async function leaveTeam(
	...args: Parameters<
		Awaited<ReturnType<typeof createTeamsActions>>["leaveTeam"]
	>
) {
	const actions = await createTeamsActions(await getRuntime());
	return actions.leaveTeam(...args);
}

export async function removeMember(
	...args: Parameters<
		Awaited<ReturnType<typeof createTeamsActions>>["removeMember"]
	>
) {
	const actions = await createTeamsActions(await getRuntime());
	return actions.removeMember(...args);
}

export async function confirmDiscordVerification(
	...args: Parameters<
		Awaited<
			ReturnType<typeof createDiscordActions>
		>["confirmDiscordVerification"]
	>
) {
	const actions = await createDiscordActions(await getRuntime());
	return actions.confirmDiscordVerification(...args);
}

export async function syncDiscordMemberRoles(
	...args: Parameters<
		Awaited<
			ReturnType<typeof createDiscordActions>
		>["syncDiscordMemberRoles"]
	>
) {
	const actions = await createDiscordActions(await getRuntime());
	return actions.syncDiscordMemberRoles(...args);
}
