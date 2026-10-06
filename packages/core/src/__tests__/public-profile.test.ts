import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "../testing.js";
import { describe, expect, it } from "vitest";

async function seedUser(hackkit: TestHackkit) {
	await createTestUser(hackkit, {
		authId: "hacker-auth",
		email: "hacker@example.com",
		name: "Hack Er",
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
		major: "Computer Science",
		levelOfStudy: "Senior",
		hackathonsAttended: 2,
		softwareExperience: "Advanced",
		githubUrl: "https://github.com/hacker",
	});
}

describe("public profiles", () => {
	it("returns Core-owned profile fields by HackTag when searchable", async () => {
		const hackkit = await createTestHackkit();
		await seedUser(hackkit);

		await hackkit.users.updateProfile({
			authId: "hacker-auth",
			hackTag: "HackerOne",
			bio: "I like building useful things.",
			pronouns: "they/them",
			skills: ["TypeScript", "Design"],
			discordDisplayHandle: "hacker",
			profilePhotoUrl: "/api/files/view?key=profile-photos%2Favatar.png",
			isProfileSearchable: true,
		});

		const profile =
			await hackkit.users.getPublicProfileByHackTag("hackerone");

		expect(profile?.user.hackTag).toBe("hackerone");
		expect(profile?.user.skills).toEqual(["typescript", "design"]);
		expect(profile?.user.bio).toBe("I like building useful things.");
		expect(profile?.hacker?.major).toBe("Computer Science");
	});

	it("hides public profiles when searchability is disabled", async () => {
		const hackkit = await createTestHackkit();
		await seedUser(hackkit);
		await hackkit.users.updateProfile({
			authId: "hacker-auth",
			hackTag: "hackerone",
			isProfileSearchable: false,
		});

		await expect(
			hackkit.users.getPublicProfileByHackTag("hackerone"),
		).resolves.toBeNull();
	});
});
