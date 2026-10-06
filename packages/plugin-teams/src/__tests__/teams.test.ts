import { createTeamsActions } from "../actions.js";
import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "@hackkit/core/testing";
import { describe, expect, it } from "vitest";

import { teamsModels } from "../models.js";
import { teamsPlugin } from "../index.js";

async function createTeamsHackkit() {
	const plugin = teamsPlugin();
	const hackkit = await createTestHackkit({
		plugins: [plugin],
	});
	return { hackkit, teams: hackkit.plugins.teams };
}

async function seedUserWithHackTag(
	hackkit: TestHackkit<readonly [ReturnType<typeof teamsPlugin>]>,
	authId: string,
	hackTag: string,
) {
	await createTestUser(hackkit, {
		authId,
		email: `${authId}@example.com`,
		name: "Test User",
	});
	await hackkit.userData.completeUserData({
		authId,
		age: 20,
		gender: "prefer_not_to_answer",
		race: "prefer_not_to_answer",
		ethnicity: "prefer_not_to_answer",
		shirtSize: "m",
		dietaryRestrictions: ["none"],
		hasAcceptedMLHCodeOfConduct: true,
		hasSharedDataWithMLH: true,
		isEmailable: true,
	});
	await hackkit.users.claimHackTag({ authId, hackTag });
}

async function seedHacker(
	hackkit: TestHackkit<readonly [ReturnType<typeof teamsPlugin>]>,
	authId: string,
	hackTag?: string,
) {
	if (!(await hackkit.users.getUser(authId)))
		await createTestUser(hackkit, {
			authId,
			email: `${authId}@example.com`,
			name: "Test User",
		});
	await hackkit.userData.completeUserData({
		authId,
		age: 20,
		gender: "prefer_not_to_answer",
		race: "prefer_not_to_answer",
		ethnicity: "prefer_not_to_answer",
		shirtSize: "m",
		dietaryRestrictions: ["none"],
		hasAcceptedMLHCodeOfConduct: true,
		hasSharedDataWithMLH: true,
		isEmailable: true,
	});
	await hackkit.hackers.registerHacker({
		authId,
		university: "Test U",
		major: "CS",
		levelOfStudy: "undergraduate",
		hackathonsAttended: 1,
		softwareExperience: "intermediate",
	});
	if (hackTag) {
		await hackkit.users.claimHackTag({ authId, hackTag });
	}
}

describe("teams plugin", () => {
	it("creates a team and adds the owner as a member", async () => {
		const { hackkit, teams } = await createTeamsHackkit();
		await seedHacker(hackkit, "owner-auth", "owner");

		const team = await teams.createTeam({
			actorAuthId: "owner-auth",
			name: "Hackers United",
			tag: "hackers-united",
		});

		expect(team.name).toBe("Hackers United");
		expect(team.members).toHaveLength(1);
		expect(team.members[0]?.authId).toBe("owner-auth");
	});

	it("accepts an invite and enforces one team per hacker", async () => {
		const { hackkit, teams } = await createTeamsHackkit();
		await seedHacker(hackkit, "owner-auth", "owner");
		await seedHacker(hackkit, "member-auth", "member");

		const team = await teams.createTeam({
			actorAuthId: "owner-auth",
			name: "Team Alpha",
			tag: "alpha",
		});
		const invite = await teams.inviteToTeam({
			actorAuthId: "owner-auth",
			teamId: team.id,
			hackTag: "member",
		});

		const listed = await teams.listTeamInvites({
			actorAuthId: "owner-auth",
			teamId: team.id,
		});
		expect(listed).toHaveLength(1);
		expect(listed[0]).toMatchObject({
			id: invite.id,
			status: "pending",
			invitee: { hackTag: "member" },
		});

		await teams.respondToInvite({
			actorAuthId: "member-auth",
			inviteId: invite.id,
			accept: true,
		});

		const memberTeam = await teams.getTeamForAuthId("member-auth");
		expect(memberTeam?.id).toBe(team.id);

		await expect(
			teams.createTeam({
				actorAuthId: "member-auth",
				name: "Other Team",
				tag: "other",
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("allows inviting a user before hacker registration", async () => {
		const { hackkit, teams } = await createTeamsHackkit();
		await seedHacker(hackkit, "owner-auth", "owner");
		await seedUserWithHackTag(hackkit, "pending-auth", "pending");

		const team = await teams.createTeam({
			actorAuthId: "owner-auth",
			name: "Team Beta",
			tag: "beta",
		});

		const invite = await teams.inviteToTeam({
			actorAuthId: "owner-auth",
			teamId: team.id,
			hackTag: "pending",
		});
		expect(invite.status).toBe("pending");

		await expect(
			teams.respondToInvite({
				actorAuthId: "pending-auth",
				inviteId: invite.id,
				accept: true,
			}),
		).rejects.toMatchObject({
			message:
				"Complete hacker registration before accepting a team invite.",
		});

		await seedHacker(hackkit, "pending-auth");
		const joined = await teams.respondToInvite({
			actorAuthId: "pending-auth",
			inviteId: invite.id,
			accept: true,
		});
		expect(joined).toMatchObject({ id: team.id });
	});
});

it("creates only one team when the same owner submits concurrently", async () => {
	const { hackkit } = await createTeamsHackkit();
	await seedHacker(hackkit, "owner-auth", "owner");
	const results = await Promise.allSettled(
		["first", "second"].map((tag) =>
			hackkit.runtime.createScope().hackkit.plugins.teams.createTeam({
				actorAuthId: "owner-auth",
				name: tag,
				tag,
			}),
		),
	);
	expect(
		results.filter((result) => result.status === "fulfilled"),
	).toHaveLength(1);
	const em = hackkit.runtime.createScope().em;
	expect(await em.count(teamsModels.team, {})).toBe(1);
	expect(await em.count(teamsModels.member, {})).toBe(1);
});

it("keeps the final team place and losing invite consistent across concurrent joins", async () => {
	const { hackkit, teams } = await createTeamsHackkit();
	await seedHacker(hackkit, "owner-auth", "owner");
	const team = await teams.createTeam({
		actorAuthId: "owner-auth",
		name: "Race",
		tag: "race",
	});
	const invites = [];
	for (const authId of ["a", "b", "c", "d"]) {
		await seedHacker(hackkit, authId, authId);
		invites.push(
			await teams.inviteToTeam({
				actorAuthId: "owner-auth",
				teamId: team.id,
				inviteeAuthId: authId,
			}),
		);
	}
	const results = await Promise.allSettled(
		invites.map((invite) =>
			hackkit.runtime
				.createScope()
				.hackkit.plugins.teams.respondToInvite({
					actorAuthId: invite.inviteeAuthId,
					inviteId: invite.id,
					accept: true,
				}),
		),
	);
	expect(
		results.filter((result) => result.status === "fulfilled"),
	).toHaveLength(3);
	const em = hackkit.runtime.createScope().em;
	expect(await em.count(teamsModels.member, { teamId: team.id })).toBe(4);
	expect(
		await em.count(teamsModels.invite, {
			teamId: team.id,
			status: "accepted",
		}),
	).toBe(3);
	expect(
		await em.count(teamsModels.invite, {
			teamId: team.id,
			status: "pending",
		}),
	).toBe(1);
});

it("uses the session actor as team owner even when the submission supplies another actor", async () => {
	const { hackkit } = await createTeamsHackkit();
	await seedHacker(hackkit, "caller", "caller");
	await seedHacker(hackkit, "other", "other");
	const actions = createTeamsActions({
		hackkit,
		getAuthId: async () => "caller",
	});
	const submitted = {
		name: "Session team",
		tag: "session-team",
		actorAuthId: "other",
	};
	const result = await actions.createTeam(submitted);
	expect(result).toMatchObject({ ok: true, data: { ownerAuthId: "caller" } });
});
