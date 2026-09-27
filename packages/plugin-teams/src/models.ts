import {
	defineEntity,
	p,
	type EntityDTO,
	type InferEntity,
} from "@mikro-orm/core";
import { HackKitProfile } from "@hackkit/core";

export const TeamsTeam = defineEntity({
	name: "TeamsTeam",
	tableName: "teams_team",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		name: p.string(),
		tag: p.string().unique(),
		ownerAuthId: () =>
			p
				.manyToOne(HackKitProfile)
				.mapToPk()
				.fieldName("owner_auth_id")
				.deleteRule("cascade"),
		createdAt: p.datetime().onCreate(() => new Date()),
	},
	indexes: [{ properties: ["tag"] }, { properties: ["ownerAuthId"] }],
});

export const TeamsMember = defineEntity({
	name: "TeamsMember",
	tableName: "teams_member",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		teamId: () =>
			p
				.manyToOne(TeamsTeam)
				.mapToPk()
				.fieldName("team_id")
				.deleteRule("cascade"),
		authId: () =>
			p
				.manyToOne(HackKitProfile)
				.mapToPk()
				.fieldName("auth_id")
				.unique()
				.deleteRule("cascade"),
		joinedAt: p.datetime().onCreate(() => new Date()),
	},
	indexes: [{ properties: ["teamId"] }, { properties: ["authId"] }],
});

export const TeamsInvite = defineEntity({
	name: "TeamsInvite",
	tableName: "teams_invite",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		teamId: () =>
			p
				.manyToOne(TeamsTeam)
				.mapToPk()
				.fieldName("team_id")
				.deleteRule("cascade"),
		inviteeAuthId: () =>
			p
				.manyToOne(HackKitProfile)
				.mapToPk()
				.fieldName("invitee_auth_id")
				.deleteRule("cascade"),
		status: p
			.enum(["pending", "accepted", "declined"] as const)
			.default("pending"),
		createdAt: p.datetime().onCreate(() => new Date()),
	},
	indexes: [
		{ properties: ["teamId"] },
		{ properties: ["inviteeAuthId"] },
		{ properties: ["teamId", "inviteeAuthId"] },
	],
});

export const teamsModels = {
	team: TeamsTeam,
	member: TeamsMember,
	invite: TeamsInvite,
} as const;
export type Team = EntityDTO<InferEntity<typeof TeamsTeam>>;
export type TeamMember = EntityDTO<InferEntity<typeof TeamsMember>>;
export type TeamInvite = EntityDTO<InferEntity<typeof TeamsInvite>>;
