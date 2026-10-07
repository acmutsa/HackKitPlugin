import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "../testing";
import { describe, expect, it } from "vitest";
import { CoreSetting } from "../settings";
import { seedTestOwner } from "./seed-test-owner";

async function seedHacker(
	hackkit: TestHackkit,
	authId: string,
	group?: string,
) {
	await createTestUser(hackkit, {
		authId,
		email: `${authId}@example.com`,
		name: "Test Hacker",
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
		levelOfStudy: "Undergraduate",
		hackathonsAttended: 1,
		softwareExperience: "Intermediate",
		group,
	});
}

describe("groups", () => {
	it("assigns approved hackers across enabled groups without overwriting existing groups", async () => {
		const hackkit = await createTestHackkit({
			groups: [
				{ id: "alpha", label: "Alpha", discordRoleName: "Alpha Role" },
				{ id: "beta", label: "Beta", discordRoleName: "Beta Role" },
			],
		});
		await seedTestOwner(hackkit);
		await hackkit.settings.setMany({
			actorAuthId: "owner-auth",
			values: [{ key: CoreSetting.RequireApproval, value: true }],
		});
		await seedHacker(hackkit, "hacker-1");
		await seedHacker(hackkit, "hacker-2");
		await seedHacker(hackkit, "hacker-3", "beta");

		await hackkit.users.approveUser({
			actorAuthId: "owner-auth",
			targetAuthId: "hacker-1",
			approved: true,
		});
		await hackkit.users.approveUser({
			actorAuthId: "owner-auth",
			targetAuthId: "hacker-2",
			approved: true,
		});
		await hackkit.users.approveUser({
			actorAuthId: "owner-auth",
			targetAuthId: "hacker-3",
			approved: true,
		});

		await expect(
			hackkit.hackers.getHacker("hacker-1"),
		).resolves.toMatchObject({
			group: "alpha",
		});
		await expect(
			hackkit.hackers.getHacker("hacker-2"),
		).resolves.toMatchObject({
			group: "alpha",
		});
		await expect(
			hackkit.hackers.getHacker("hacker-3"),
		).resolves.toMatchObject({
			group: "beta",
		});
		expect(hackkit.groups.listGroups()).toHaveLength(2);
	});
});
