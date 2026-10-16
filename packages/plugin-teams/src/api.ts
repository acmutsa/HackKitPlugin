import {
	promiseApi,
	type BoundaryError,
	fromResult,
} from "@hackkit/core/effect";
import { Effect } from "effect";

import { wrap } from "@mikro-orm/core";
import {
	coreModels,
	HackKitError,
	withOperationLockEffect,
	type AuthId,
	type User,
	type HackKitPluginContext,
} from "@hackkit/core";

import {
	teamsModels,
	type Team,
	type TeamInvite,
	type TeamMember,
} from "./models";
import { TeamsSetting } from "./settings";
export type TeamWithMembers = Team & {
	members: (TeamMember & {
		user: User;
	})[];
};
export type PendingTeamInvite = TeamInvite & {
	team: Team;
};
export type TeamInviteWithInvitee = TeamInvite & {
	invitee: User;
};
function requireHacker(
	context: HackKitPluginContext,
	authId: AuthId,
	message = "Only Hackers can participate in teams.",
): Effect.Effect<void, BoundaryError> {
	return Effect.gen(function* () {
		const hacker = yield* fromResult(
			context.em.findOne(coreModels.hacker, {
				userId: authId,
			}),
		);
		if (!hacker) {
			return yield* Effect.fail(
				new HackKitError("INVALID_OPERATION", message),
			);
		}
	});
}
function getMemberForAuthId(
	context: HackKitPluginContext,
	authId: AuthId,
): Effect.Effect<TeamMember | null, BoundaryError> {
	return Effect.suspend(() =>
		fromResult(context.em.findOne(teamsModels.member, { authId })),
	);
}
function getTeamOrThrow(
	context: HackKitPluginContext,
	teamId: string,
): Effect.Effect<Team, BoundaryError> {
	return Effect.gen(function* () {
		const team = yield* fromResult(
			context.em.findOne(teamsModels.team, { id: teamId }),
		);
		if (!team) {
			return yield* Effect.fail(
				new HackKitError("NOT_FOUND", "Team not found."),
			);
		}
		return team;
	});
}
function assertNotOnTeam(
	context: HackKitPluginContext,
	authId: AuthId,
): Effect.Effect<void, BoundaryError> {
	return Effect.gen(function* () {
		const member = yield* getMemberForAuthId(context, authId);
		if (member) {
			return yield* Effect.fail(
				new HackKitError("CONFLICT", "User is already on a team."),
			);
		}
	});
}
function resolveInviteeAuthId(
	context: HackKitPluginContext,
	target: {
		inviteeAuthId?: AuthId;
		hackTag?: string;
	},
): Effect.Effect<AuthId, BoundaryError> {
	return Effect.gen(function* () {
		if (target.inviteeAuthId) return target.inviteeAuthId;
		if (!target.hackTag?.trim()) {
			return yield* Effect.fail(
				new HackKitError("INVALID_OPERATION", "Invitee is required."),
			);
		}
		const user = yield* fromResult(
			context.em.findOne(coreModels.user, {
				hackTag: target.hackTag.trim().toLowerCase(),
			}),
		);
		if (!user) {
			return yield* Effect.fail(
				new HackKitError(
					"NOT_FOUND",
					"User with that HackTag was not found.",
				),
			);
		}
		return user.id;
	});
}
function assertTeamHasRoom(
	context: HackKitPluginContext,
	teamId: string,
): Effect.Effect<void, BoundaryError> {
	return Effect.gen(function* () {
		const maximumTeamSize = yield* fromResult(
			context.getSettingValue(TeamsSetting.MaximumTeamSize),
		);
		if (typeof maximumTeamSize !== "number" || maximumTeamSize === 0)
			return;
		const members = yield* fromResult(
			context.em.find(teamsModels.member, { teamId }),
		);
		if (members.length >= maximumTeamSize) {
			return yield* Effect.fail(
				new HackKitError(
					"INVALID_OPERATION",
					"Maximum team size has been reached.",
				),
			);
		}
	});
}
function hydrateTeam(
	context: HackKitPluginContext,
	team: Team,
): Effect.Effect<TeamWithMembers, BoundaryError> {
	return Effect.gen(function* () {
		const members = yield* fromResult(
			context.em.find(
				teamsModels.member,
				{ teamId: team.id },
				{ orderBy: { joinedAt: "asc" } },
			),
		);
		const users = yield* Effect.forEach(
			members.map((member) =>
				Effect.gen(function* () {
					const user = yield* fromResult(
						context.getUser(member.authId),
					);
					if (!user) {
						return yield* Effect.fail(
							new HackKitError(
								"NOT_FOUND",
								"Team member user not found.",
							),
						);
					}
					return {
						...wrap(member).toObject(),
						user,
					};
				}),
			),
			(value) => value,
			{ concurrency: "unbounded" },
		);
		return { ...wrap(team).toObject(), members: users };
	});
}
export function createTeamsEffects(context: HackKitPluginContext) {
	const { em, registry } = context;
	return {
		createTeam(input: {
			actorAuthId: AuthId;
			name: string;
			tag: string;
		}): Effect.Effect<TeamWithMembers, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "teams.membership", () =>
					Effect.gen(function* () {
						yield* requireHacker(context, input.actorAuthId);
						yield* assertNotOnTeam(context, input.actorAuthId);
						const normalizedTag = input.tag.trim().toLowerCase();
						if (!normalizedTag) {
							return yield* Effect.fail(
								new HackKitError(
									"INVALID_OPERATION",
									"Team tag is required.",
								),
							);
						}
						const existingTag = yield* fromResult(
							em.findOne(teamsModels.team, {
								tag: normalizedTag,
							}),
						);
						if (existingTag) {
							return yield* Effect.fail(
								new HackKitError(
									"CONFLICT",
									"Team tag is already taken.",
								),
							);
						}
						const team = em.create(teamsModels.team, {
							name: input.name.trim(),
							tag: normalizedTag,
							ownerAuthId: input.actorAuthId,
						});
						yield* fromResult(em.flush());
						{
							em.create(teamsModels.member, {
								teamId: team.id,
								authId: input.actorAuthId,
							});
							yield* fromResult(em.flush());
						}
						return yield* hydrateTeam(context, team);
					}),
				),
			);
		},
		inviteToTeam(input: {
			actorAuthId: AuthId;
			teamId: string;
			inviteeAuthId?: AuthId;
			hackTag?: string;
		}): Effect.Effect<TeamInvite, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "teams.membership", () =>
					Effect.gen(function* () {
						const team = yield* getTeamOrThrow(
							context,
							input.teamId,
						);
						if (team.ownerAuthId !== input.actorAuthId) {
							return yield* Effect.fail(
								new HackKitError(
									"FORBIDDEN",
									"Only the team owner can send invites.",
								),
							);
						}
						const inviteeAuthId = yield* resolveInviteeAuthId(
							context,
							input,
						);
						if (inviteeAuthId === input.actorAuthId) {
							return yield* Effect.fail(
								new HackKitError(
									"INVALID_OPERATION",
									"You cannot invite yourself.",
								),
							);
						}
						yield* assertNotOnTeam(context, inviteeAuthId);
						const existingInvite = yield* fromResult(
							em.findOne(teamsModels.invite, {
								teamId: input.teamId,
								inviteeAuthId,
								status: "pending",
							}),
						);
						if (existingInvite) {
							return yield* Effect.fail(
								new HackKitError(
									"CONFLICT",
									"An invite is already pending for this user.",
								),
							);
						}
						{
							const created = em.create(teamsModels.invite, {
								teamId: input.teamId,
								inviteeAuthId,
								status: "pending",
							});
							yield* fromResult(em.flush());
							return wrap(created).toObject();
						}
					}),
				),
			);
		},
		respondToInvite(input: {
			actorAuthId: AuthId;
			inviteId: string;
			accept: boolean;
		}): Effect.Effect<TeamInvite | TeamWithMembers, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "teams.membership", () =>
					Effect.gen(function* () {
						const invite = yield* fromResult(
							em.findOne(teamsModels.invite, {
								id: input.inviteId,
							}),
						);
						if (!invite) {
							return yield* Effect.fail(
								new HackKitError(
									"NOT_FOUND",
									"Invite not found.",
								),
							);
						}
						if (invite.inviteeAuthId !== input.actorAuthId) {
							return yield* Effect.fail(
								new HackKitError(
									"FORBIDDEN",
									"You can only respond to your own invites.",
								),
							);
						}
						if (invite.status !== "pending") {
							return yield* Effect.fail(
								new HackKitError(
									"INVALID_OPERATION",
									"Invite has already been responded to.",
								),
							);
						}
						if (!input.accept) {
							const updated = yield* fromResult(
								em.findOne(teamsModels.invite, {
									id: invite.id,
								}),
							);
							if (updated) {
								em.assign(
									updated,
									{ status: "declined" },
									{ ignoreUndefined: true },
								);
								yield* fromResult(em.flush());
							}
							return wrap(updated ?? invite).toObject();
						}
						yield* requireHacker(
							context,
							input.actorAuthId,
							"Complete hacker registration before accepting a team invite.",
						);
						yield* assertNotOnTeam(context, input.actorAuthId);
						yield* assertTeamHasRoom(context, invite.teamId);
						{
							em.create(teamsModels.member, {
								teamId: invite.teamId,
								authId: input.actorAuthId,
							});
							yield* fromResult(em.flush());
						}
						{
							const updatedRows = yield* fromResult(
								em.find(teamsModels.invite, {
									id: invite.id,
								}),
							);
							for (const row of updatedRows)
								em.assign(
									row,
									{ status: "accepted" },
									{ ignoreUndefined: true },
								);
							yield* fromResult(em.flush());
						}
						const team = yield* getTeamOrThrow(
							context,
							invite.teamId,
						);
						return yield* hydrateTeam(context, team);
					}),
				),
			);
		},
		leaveTeam(input: {
			actorAuthId: AuthId;
		}): Effect.Effect<void, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "teams.membership", () =>
					Effect.gen(function* () {
						const member = yield* getMemberForAuthId(
							context,
							input.actorAuthId,
						);
						if (!member) {
							return yield* Effect.fail(
								new HackKitError(
									"NOT_FOUND",
									"You are not on a team.",
								),
							);
						}
						const team = yield* getTeamOrThrow(
							context,
							member.teamId,
						);
						if (team.ownerAuthId === input.actorAuthId) {
							return yield* Effect.fail(
								new HackKitError(
									"INVALID_OPERATION",
									"Team owners cannot leave their team.",
								),
							);
						}
						yield* fromResult(
							em.nativeDelete(teamsModels.member, {
								id: member.id,
							}),
						);
					}),
				),
			);
		},
		removeMember(input: {
			actorAuthId: AuthId;
			memberAuthId: AuthId;
		}): Effect.Effect<void, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "teams.membership", () =>
					Effect.gen(function* () {
						const member = yield* getMemberForAuthId(
							context,
							input.memberAuthId,
						);
						if (!member) {
							return yield* Effect.fail(
								new HackKitError(
									"NOT_FOUND",
									"Team member not found.",
								),
							);
						}
						const team = yield* getTeamOrThrow(
							context,
							member.teamId,
						);
						if (team.ownerAuthId !== input.actorAuthId) {
							return yield* Effect.fail(
								new HackKitError(
									"FORBIDDEN",
									"Only the team owner can remove members.",
								),
							);
						}
						if (member.authId === team.ownerAuthId) {
							return yield* Effect.fail(
								new HackKitError(
									"INVALID_OPERATION",
									"The team owner cannot be removed.",
								),
							);
						}
						yield* fromResult(
							em.nativeDelete(teamsModels.member, {
								id: member.id,
							}),
						);
					}),
				),
			);
		},
		getTeamForAuthId(
			authId: AuthId,
		): Effect.Effect<TeamWithMembers | null, BoundaryError> {
			return Effect.gen(function* () {
				const member = yield* getMemberForAuthId(context, authId);
				if (!member) return null;
				const team = yield* getTeamOrThrow(context, member.teamId);
				return yield* hydrateTeam(context, team);
			});
		},
		listTeamMembers(teamId: string): Effect.Effect<
			(TeamMember & {
				user: User;
			})[],
			BoundaryError
		> {
			return Effect.gen(function* () {
				const team = yield* getTeamOrThrow(context, teamId);
				return (yield* hydrateTeam(context, team)).members;
			});
		},
		listPendingInvites(
			authId: AuthId,
		): Effect.Effect<PendingTeamInvite[], BoundaryError> {
			return Effect.gen(function* () {
				const invites = yield* fromResult(
					em.find(
						teamsModels.invite,
						{ inviteeAuthId: authId, status: "pending" },
						{ orderBy: { createdAt: "desc" } },
					),
				);
				return yield* Effect.forEach(
					invites.map((invite) =>
						Effect.gen(function* () {
							return {
								...wrap(invite).toObject(),
								team: wrap(
									yield* getTeamOrThrow(
										context,
										invite.teamId,
									),
								).toObject(),
							};
						}),
					),
					(value) => value,
					{ concurrency: "unbounded" },
				);
			});
		},
		listTeamInvites(input: {
			actorAuthId: AuthId;
			teamId: string;
		}): Effect.Effect<TeamInviteWithInvitee[], BoundaryError> {
			return Effect.gen(function* () {
				const team = yield* getTeamOrThrow(context, input.teamId);
				if (team.ownerAuthId !== input.actorAuthId) {
					return yield* Effect.fail(
						new HackKitError(
							"FORBIDDEN",
							"Only the team owner can view team invites.",
						),
					);
				}
				const invites = yield* fromResult(
					em.find(
						teamsModels.invite,
						{ teamId: input.teamId },
						{ orderBy: { createdAt: "desc" } },
					),
				);
				return yield* Effect.forEach(
					invites.map((invite) =>
						Effect.gen(function* () {
							const invitee = yield* fromResult(
								context.getUser(invite.inviteeAuthId),
							);
							if (!invitee) {
								return yield* Effect.fail(
									new HackKitError(
										"NOT_FOUND",
										"Invited user not found.",
									),
								);
							}
							return {
								...wrap(invite).toObject(),
								invitee,
							};
						}),
					),
					(value) => value,
					{ concurrency: "unbounded" },
				);
			});
		},
		models: teamsModels,
		permissions: registry.permissions,
	};
}
export type TeamsApi = ReturnType<typeof createTeamsApi>;
export function createTeamsApi(context: HackKitPluginContext) {
	return promiseApi(createTeamsEffects(context));
}
