import { wrap } from "@mikro-orm/core";
import { coreModels, HackKitError, withOperationLock } from "@hackkit/core";
import type { AuthId, User } from "@hackkit/core";
import type { HackKitPluginContext } from "@hackkit/core";
import {
	teamsModels,
	type Team,
	type TeamInvite,
	type TeamMember,
} from "./models";
import { TeamsSetting } from "./settings";

export type TeamWithMembers = Team & {
	members: (TeamMember & { user: User })[];
};

export type PendingTeamInvite = TeamInvite & { team: Team };
export type TeamInviteWithInvitee = TeamInvite & { invitee: User };

async function requireHacker(
	context: HackKitPluginContext,
	authId: AuthId,
	message = "Only Hackers can participate in teams.",
): Promise<void> {
	const hacker = await context.em.findOne(coreModels.hacker, { authId });
	if (!hacker) {
		throw new HackKitError("INVALID_OPERATION", message);
	}
}

async function getMemberForAuthId(
	context: HackKitPluginContext,
	authId: AuthId,
): Promise<TeamMember | null> {
	return context.em.findOne(teamsModels.member, { authId });
}

async function getTeamOrThrow(
	context: HackKitPluginContext,
	teamId: string,
): Promise<Team> {
	const team = await context.em.findOne(teamsModels.team, { id: teamId });
	if (!team) {
		throw new HackKitError("NOT_FOUND", "Team not found.");
	}
	return team;
}

async function assertNotOnTeam(
	context: HackKitPluginContext,
	authId: AuthId,
): Promise<void> {
	const member = await getMemberForAuthId(context, authId);
	if (member) {
		throw new HackKitError("CONFLICT", "User is already on a team.");
	}
}

async function resolveInviteeAuthId(
	context: HackKitPluginContext,
	target: { inviteeAuthId?: AuthId; hackTag?: string },
): Promise<AuthId> {
	if (target.inviteeAuthId) return target.inviteeAuthId;
	if (!target.hackTag?.trim()) {
		throw new HackKitError("INVALID_OPERATION", "Invitee is required.");
	}
	const user = await context.em.findOne(coreModels.user, {
		hackTag: target.hackTag.trim().toLowerCase(),
	});
	if (!user) {
		throw new HackKitError(
			"NOT_FOUND",
			"User with that HackTag was not found.",
		);
	}
	return user.id;
}

async function assertTeamHasRoom(
	context: HackKitPluginContext,
	teamId: string,
): Promise<void> {
	const maximumTeamSize = await context.getSettingValue(
		TeamsSetting.MaximumTeamSize,
	);
	if (typeof maximumTeamSize !== "number" || maximumTeamSize === 0) return;
	const members = await context.em.find(teamsModels.member, { teamId });
	if (members.length >= maximumTeamSize) {
		throw new HackKitError(
			"INVALID_OPERATION",
			"Maximum team size has been reached.",
		);
	}
}

async function hydrateTeam(
	context: HackKitPluginContext,
	team: Team,
): Promise<TeamWithMembers> {
	const members = await context.em.find(
		teamsModels.member,
		{ teamId: team.id },
		{ orderBy: { joinedAt: "asc" } },
	);
	const users = await Promise.all(
		members.map(async (member) => {
			const user = await context.getUser(member.authId);
			if (!user) {
				throw new HackKitError(
					"NOT_FOUND",
					"Team member user not found.",
				);
			}
			return { ...wrap(member).toObject(), user };
		}),
	);
	return { ...wrap(team).toObject(), members: users };
}

export function createTeamsApi(context: HackKitPluginContext) {
	const { em, registry } = context;

	return {
		async createTeam(input: {
			actorAuthId: AuthId;
			name: string;
			tag: string;
		}): Promise<TeamWithMembers> {
			return withOperationLock(em, "teams.membership", async () => {
				await requireHacker(context, input.actorAuthId);
				await assertNotOnTeam(context, input.actorAuthId);

				const normalizedTag = input.tag.trim().toLowerCase();
				if (!normalizedTag) {
					throw new HackKitError(
						"INVALID_OPERATION",
						"Team tag is required.",
					);
				}

				const existingTag = await em.findOne(teamsModels.team, {
					tag: normalizedTag,
				});
				if (existingTag) {
					throw new HackKitError(
						"CONFLICT",
						"Team tag is already taken.",
					);
				}

				const team = em.create(teamsModels.team, {
					name: input.name.trim(),
					tag: normalizedTag,
					ownerAuthId: input.actorAuthId,
				});
				await em.flush();
				{
					em.create(teamsModels.member, {
						teamId: team.id,
						authId: input.actorAuthId,
					});
					await em.flush();
				}
				return hydrateTeam(context, team);
			});
		},

		async inviteToTeam(input: {
			actorAuthId: AuthId;
			teamId: string;
			inviteeAuthId?: AuthId;
			hackTag?: string;
		}): Promise<TeamInvite> {
			return withOperationLock(em, "teams.membership", async () => {
				const team = await getTeamOrThrow(context, input.teamId);
				if (team.ownerAuthId !== input.actorAuthId) {
					throw new HackKitError(
						"FORBIDDEN",
						"Only the team owner can send invites.",
					);
				}

				const inviteeAuthId = await resolveInviteeAuthId(
					context,
					input,
				);
				if (inviteeAuthId === input.actorAuthId) {
					throw new HackKitError(
						"INVALID_OPERATION",
						"You cannot invite yourself.",
					);
				}

				await assertNotOnTeam(context, inviteeAuthId);

				const existingInvite = await em.findOne(teamsModels.invite, {
					teamId: input.teamId,
					inviteeAuthId,
					status: "pending",
				});
				if (existingInvite) {
					throw new HackKitError(
						"CONFLICT",
						"An invite is already pending for this user.",
					);
				}

				{
					const created = em.create(teamsModels.invite, {
						teamId: input.teamId,
						inviteeAuthId,
						status: "pending",
					});
					await em.flush();
					return wrap(created).toObject();
				}
			});
		},

		async respondToInvite(input: {
			actorAuthId: AuthId;
			inviteId: string;
			accept: boolean;
		}): Promise<TeamInvite | TeamWithMembers> {
			return withOperationLock(em, "teams.membership", async () => {
				const invite = await em.findOne(teamsModels.invite, {
					id: input.inviteId,
				});
				if (!invite) {
					throw new HackKitError("NOT_FOUND", "Invite not found.");
				}
				if (invite.inviteeAuthId !== input.actorAuthId) {
					throw new HackKitError(
						"FORBIDDEN",
						"You can only respond to your own invites.",
					);
				}
				if (invite.status !== "pending") {
					throw new HackKitError(
						"INVALID_OPERATION",
						"Invite has already been responded to.",
					);
				}

				if (!input.accept) {
					const updated = await em.findOne(teamsModels.invite, {
						id: invite.id,
					});
					if (updated) {
						em.assign(
							updated,
							{ status: "declined" },
							{ ignoreUndefined: true },
						);
						await em.flush();
					}
					return wrap(updated ?? invite).toObject();
				}

				await requireHacker(
					context,
					input.actorAuthId,
					"Complete hacker registration before accepting a team invite.",
				);
				await assertNotOnTeam(context, input.actorAuthId);

				await assertTeamHasRoom(context, invite.teamId);
				{
					em.create(teamsModels.member, {
						teamId: invite.teamId,
						authId: input.actorAuthId,
					});
					await em.flush();
				}
				{
					const updatedRows = await em.find(teamsModels.invite, {
						id: invite.id,
					});
					for (const row of updatedRows)
						em.assign(
							row,
							{ status: "accepted" },
							{ ignoreUndefined: true },
						);
					await em.flush();
				}
				const team = await getTeamOrThrow(context, invite.teamId);
				return hydrateTeam(context, team);
			});
		},

		async leaveTeam(input: { actorAuthId: AuthId }): Promise<void> {
			return withOperationLock(em, "teams.membership", async () => {
				const member = await getMemberForAuthId(
					context,
					input.actorAuthId,
				);
				if (!member) {
					throw new HackKitError(
						"NOT_FOUND",
						"You are not on a team.",
					);
				}
				const team = await getTeamOrThrow(context, member.teamId);
				if (team.ownerAuthId === input.actorAuthId) {
					throw new HackKitError(
						"INVALID_OPERATION",
						"Team owners cannot leave their team.",
					);
				}
				await em.nativeDelete(teamsModels.member, { id: member.id });
			});
		},

		async removeMember(input: {
			actorAuthId: AuthId;
			memberAuthId: AuthId;
		}): Promise<void> {
			return withOperationLock(em, "teams.membership", async () => {
				const member = await getMemberForAuthId(
					context,
					input.memberAuthId,
				);
				if (!member) {
					throw new HackKitError(
						"NOT_FOUND",
						"Team member not found.",
					);
				}
				const team = await getTeamOrThrow(context, member.teamId);
				if (team.ownerAuthId !== input.actorAuthId) {
					throw new HackKitError(
						"FORBIDDEN",
						"Only the team owner can remove members.",
					);
				}
				if (member.authId === team.ownerAuthId) {
					throw new HackKitError(
						"INVALID_OPERATION",
						"The team owner cannot be removed.",
					);
				}
				await em.nativeDelete(teamsModels.member, { id: member.id });
			});
		},

		async getTeamForAuthId(
			authId: AuthId,
		): Promise<TeamWithMembers | null> {
			const member = await getMemberForAuthId(context, authId);
			if (!member) return null;
			const team = await getTeamOrThrow(context, member.teamId);
			return hydrateTeam(context, team);
		},

		async listTeamMembers(
			teamId: string,
		): Promise<(TeamMember & { user: User })[]> {
			const team = await getTeamOrThrow(context, teamId);
			return (await hydrateTeam(context, team)).members;
		},

		async listPendingInvites(authId: AuthId): Promise<PendingTeamInvite[]> {
			const invites = await em.find(
				teamsModels.invite,
				{ inviteeAuthId: authId, status: "pending" },
				{ orderBy: { createdAt: "desc" } },
			);
			return Promise.all(
				invites.map(async (invite) => ({
					...wrap(invite).toObject(),
					team: wrap(
						await getTeamOrThrow(context, invite.teamId),
					).toObject(),
				})),
			);
		},

		async listTeamInvites(input: {
			actorAuthId: AuthId;
			teamId: string;
		}): Promise<TeamInviteWithInvitee[]> {
			const team = await getTeamOrThrow(context, input.teamId);
			if (team.ownerAuthId !== input.actorAuthId) {
				throw new HackKitError(
					"FORBIDDEN",
					"Only the team owner can view team invites.",
				);
			}
			const invites = await em.find(
				teamsModels.invite,
				{ teamId: input.teamId },
				{ orderBy: { createdAt: "desc" } },
			);
			return Promise.all(
				invites.map(async (invite) => {
					const invitee = await context.getUser(invite.inviteeAuthId);
					if (!invitee) {
						throw new HackKitError(
							"NOT_FOUND",
							"Invited user not found.",
						);
					}
					return { ...wrap(invite).toObject(), invitee };
				}),
			);
		},

		models: teamsModels,
		permissions: registry.permissions,
	};
}

export type TeamsApi = ReturnType<typeof createTeamsApi>;
