"use server";

import type {
	CreateTeamInput,
	InviteToTeamInput,
	RemoveMemberInput,
	RespondToInviteInput,
} from "@hackkit/plugin-teams";
import type { ConfirmDiscordVerificationInput } from "@hackkit/plugin-discord";
import { actionFailure, actionSuccess } from "@hackkit/ui/actions";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";

async function perform<T>(operation: () => Promise<T>, fallback: string) {
	try {
		return actionSuccess(await operation());
	} catch (error) {
		return actionFailure(error, fallback);
	}
}

export async function createTeam(values: CreateTeamInput) {
	return perform(
		async () =>
			auth.api.createHackkitTeam({
				headers: await hackkitHeaders(),
				body: values,
			}),
		"Could not create team.",
	);
}

export async function inviteToTeam(values: InviteToTeamInput) {
	return perform(
		async () =>
			auth.api.inviteToHackkitTeam({
				headers: await hackkitHeaders(),
				body: values,
			}),
		"Could not send invite.",
	);
}

export async function respondToInvite(values: RespondToInviteInput) {
	return perform(
		async () =>
			auth.api.respondToHackkitTeamInvite({
				headers: await hackkitHeaders(),
				body: values,
			}),
		"Could not respond to invite.",
	);
}

export async function leaveTeam() {
	return perform(async () => {
		await auth.api.leaveHackkitTeam({ headers: await hackkitHeaders() });
	}, "Could not leave team.");
}

export async function removeMember(values: RemoveMemberInput) {
	return perform(async () => {
		await auth.api.removeHackkitTeamMember({
			headers: await hackkitHeaders(),
			body: values,
		});
	}, "Could not remove team member.");
}

export async function confirmDiscordVerification(
	values: ConfirmDiscordVerificationInput,
) {
	return perform(
		async () =>
			auth.api.confirmHackkitDiscordVerification({
				headers: await hackkitHeaders(),
				body: values,
			}),
		"Could not link Discord account.",
	);
}

export async function syncDiscordMemberRoles() {
	return perform(
		async () =>
			auth.api.syncHackkitDiscordRoles({
				headers: await hackkitHeaders(),
			}),
		"Could not sync Discord roles.",
	);
}
