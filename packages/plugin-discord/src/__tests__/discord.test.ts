import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "@hackkit/core/testing";
import { describe, expect, it } from "vitest";

import {
	discordPlugin,
	type DiscordApi,
	type DiscordRoleSyncInput,
} from "../index";

async function createDiscordHackkit() {
	const syncInputs: DiscordRoleSyncInput[] = [];
	const plugin = discordPlugin({
		guildId: "guild-1",
		verificationBaseUrl: "https://hackkit.test",
		participantRole: { id: "participant-role" },
		roleSyncProvider: {
			async syncRoles(input) {
				expect(hackkit.em.isInTransaction()).toBe(false);
				syncInputs.push(input);
			},
		},
	});
	const hackkit = await createTestHackkit({
		plugins: [plugin],
		groups: [{ id: "alpha", label: "Alpha", discordRoleId: "alpha-role" }],
	});
	return {
		hackkit,
		discord: hackkit.plugins.discord,
		syncInputs,
	};
}

async function seedApprovedHacker(
	hackkit: TestHackkit<readonly [ReturnType<typeof discordPlugin>]>,
) {
	await createTestUser(hackkit, {
		authId: "hacker-auth",
		email: "hacker@example.com",
		name: "Hazel Hacker",
	});
	await hackkit.userData.completeUserData({
		authId: "hacker-auth",
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
		authId: "hacker-auth",
		university: "Test U",
		major: "CS",
		levelOfStudy: "Undergraduate",
		hackathonsAttended: 1,
		softwareExperience: "Intermediate",
		group: "alpha",
	});
}

describe("discord plugin", () => {
	it("links a pending verification and syncs participant and group roles", async () => {
		const { hackkit, discord, syncInputs } = await createDiscordHackkit();
		await seedApprovedHacker(hackkit);

		const verification = await discord.createVerification({
			code: "code-1",
			discordUserId: "discord-1",
			username: "hacker",
		});
		expect(verification.verificationUrl).toBe(
			"https://hackkit.test/discord/verify?code=code-1",
		);

		const member = await discord.confirmVerification({
			authId: "hacker-auth",
			code: "code-1",
		});

		expect(member).toMatchObject({
			authId: "hacker-auth",
			discordUserId: "discord-1",
			username: "hacker",
		});
		expect(syncInputs).toHaveLength(1);
		expect(syncInputs[0]).toMatchObject({
			authId: "hacker-auth",
			discordUserId: "discord-1",
			guildId: "guild-1",
			roleIds: ["participant-role", "alpha-role"],
			nickname: "Hazel Hacker",
		});
		await expect(discord.getVerification("code-1")).resolves.toMatchObject({
			status: "accepted",
			authId: "hacker-auth",
		});
	});
});

it("consumes a verification code once across concurrent requests", async () => {
	const { hackkit, discord, syncInputs } = await createDiscordHackkit();
	await seedApprovedHacker(hackkit);
	await discord.createVerification({
		code: "race",
		discordUserId: "discord-race",
		username: "racer",
	});
	const results = await Promise.allSettled(
		[1, 2].map(() =>
			hackkit.runtime
				.createScope()
				.hackkit.plugins.discord.confirmVerification({
					authId: "hacker-auth",
					code: "race",
				}),
		),
	);
	expect(
		results.filter((result) => result.status === "fulfilled"),
	).toHaveLength(1);
	expect(
		results.find((result) => result.status === "rejected"),
	).toMatchObject({ reason: { code: "INVALID_OPERATION" } });
	expect(syncInputs).toHaveLength(1);
	expect(await discord.getVerification("race")).toMatchObject({
		status: "accepted",
		authId: "hacker-auth",
	});
});
