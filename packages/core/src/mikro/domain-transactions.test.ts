import { expect, it } from "vitest";
import { createTestHackkit, createTestUser } from "../testing.js";
import { CoreSetting } from "../settings.js";
import { seedTestOwner } from "../__tests__/seed-test-owner.js";

const registration = {
	university: "UTSA",
	major: "Computer Science",
	levelOfStudy: "undergraduate",
	hackathonsAttended: 0,
	softwareExperience: "beginner",
};
async function prepareParticipant(
	hackkit: Awaited<ReturnType<typeof createTestHackkit>>,
	authId: string,
) {
	await createTestUser(hackkit, {
		authId,
		email: `${authId}@example.com`,
		name: "Test Hacker",
	});
	await hackkit.userData.completeUserData({
		authId,
		age: 21,
		gender: "prefer_not_to_answer",
		race: "prefer_not_to_answer",
		ethnicity: "prefer_not_to_answer",
		shirtSize: "m",
		dietaryRestrictions: ["none"],
		hasAcceptedMLHCodeOfConduct: true,
		hasSharedDataWithMLH: true,
		isEmailable: false,
	});
}

it("rolls registration back when assigning the configured role fails", async () => {
	const hackkit = await createTestHackkit({
		defaultCompetitorRoleId: "missing-role",
	});
	await prepareParticipant(hackkit, "participant");
	await expect(
		hackkit.hackers.registerHacker({
			...registration,
			authId: "participant",
		}),
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	const fresh = hackkit.runtime.createScope().hackkit;
	await expect(fresh.hackers.getHacker("participant")).resolves.toBeNull();
	expect((await fresh.users.getUser("participant"))?.isApproved).toBe(false);
});

it("admits only one concurrent registration into the final place", async () => {
	const hackkit = await createTestHackkit();
	await seedTestOwner(hackkit);
	await hackkit.settings.set({
		actorAuthId: "owner-auth",
		key: CoreSetting.MaximumRegistrations,
		value: 1,
	});
	await prepareParticipant(hackkit, "one");
	await prepareParticipant(hackkit, "two");
	const results = await Promise.allSettled(
		["one", "two"].map((authId) =>
			hackkit.runtime
				.createScope()
				.hackkit.hackers.registerHacker({ ...registration, authId }),
		),
	);
	expect(
		results.filter((result) => result.status === "fulfilled"),
	).toHaveLength(1);
	const rejected = results.find((result) => result.status === "rejected");
	expect(rejected).toMatchObject({ reason: { code: "INVALID_OPERATION" } });
});
