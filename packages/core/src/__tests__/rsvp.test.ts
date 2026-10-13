import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "../testing";
import { describe, expect, it } from "vitest";
import { CoreNotificationKind, CoreSetting } from "../index";
import { seedTestOwner } from "./seed-test-owner";

async function setSetting(
	hackkit: TestHackkit,
	key: CoreSetting,
	value: boolean | number,
) {
	await hackkit.settings.set({
		actorAuthId: "admin-auth",
		key,
		value,
	});
}

async function seedApprovedHacker(hackkit: TestHackkit, authId: string) {
	await createTestUser(hackkit, {
		authId,
		email: `${authId}@example.com`,
		name: `${authId} Hacker`,
	});
	await hackkit.userData.completeUserData({
		authId,
		age: 20,
		gender: "prefer_not_to_answer",
		race: "prefer_not_to_answer",
		ethnicity: "prefer_not_to_answer",
		shirtSize: "m",
		dietaryRestrictions: [],
		hasAcceptedMLHCodeOfConduct: true,
		hasSharedDataWithMLH: true,
		isEmailable: true,
	});
	await hackkit.hackers.registerHacker({
		userId: authId,
		university: "Test U",
		major: "CS",
		levelOfStudy: "undergraduate",
		hackathonsAttended: 0,
		softwareExperience: "intermediate",
	});
}

describe("RSVP", () => {
	it("requires RSVPs to be open and limited to approved hackers", async () => {
		const hackkit = await createTestHackkit();
		await seedTestOwner(hackkit, "admin-auth");
		await seedApprovedHacker(hackkit, "hacker-auth");

		await expect(
			hackkit.rsvp.confirm({ authId: "hacker-auth" }),
		).rejects.toMatchObject({ code: "INVALID_OPERATION" });

		await setSetting(hackkit, CoreSetting.RsvpOpen, true);
		await createTestUser(hackkit, {
			authId: "unregistered-auth",
			email: "unregistered@example.com",
			name: "Unregistered User",
		});
		await expect(
			hackkit.rsvp.confirm({ authId: "unregistered-auth" }),
		).rejects.toMatchObject({ code: "INVALID_OPERATION" });

		await expect(
			hackkit.rsvp.confirm({ authId: "hacker-auth" }),
		).resolves.toMatchObject({
			status: "confirmed",
		});
	});

	it("places over-limit hackers on an ordered waitlist and queues intents", async () => {
		const hackkit = await createTestHackkit();
		await seedTestOwner(hackkit, "admin-auth");
		await setSetting(hackkit, CoreSetting.RsvpOpen, true);
		await setSetting(hackkit, CoreSetting.RsvpLimit, 1);
		await setSetting(hackkit, CoreSetting.RsvpWaitlistEnabled, true);
		await seedApprovedHacker(hackkit, "first-auth");
		await seedApprovedHacker(hackkit, "second-auth");

		await expect(
			hackkit.rsvp.confirm({ authId: "first-auth" }),
		).resolves.toMatchObject({
			status: "confirmed",
		});
		await expect(
			hackkit.rsvp.confirm({ authId: "second-auth" }),
		).resolves.toMatchObject({
			status: "waitlisted",
			waitlistPosition: 1,
		});

		await expect(hackkit.rsvp.getSummary()).resolves.toMatchObject({
			confirmedCount: 1,
			waitlistedCount: 1,
			availableSpots: 0,
		});
		await expect(
			hackkit.notifications.listIntents({
				kind: CoreNotificationKind.RsvpConfirmed,
			}),
		).resolves.toHaveLength(1);
		await expect(
			hackkit.notifications.listIntents({
				kind: CoreNotificationKind.RsvpWaitlisted,
			}),
		).resolves.toHaveLength(1);
	});

	it("lets admins cancel and promote waitlisted RSVPs", async () => {
		const hackkit = await createTestHackkit();
		await seedTestOwner(hackkit, "admin-auth");
		await setSetting(hackkit, CoreSetting.RsvpOpen, true);
		await setSetting(hackkit, CoreSetting.RsvpLimit, 1);
		await setSetting(hackkit, CoreSetting.RsvpWaitlistEnabled, true);
		await seedApprovedHacker(hackkit, "first-auth");
		await seedApprovedHacker(hackkit, "second-auth");
		await hackkit.rsvp.confirm({ authId: "first-auth" });
		await hackkit.rsvp.confirm({ authId: "second-auth" });

		await expect(
			hackkit.rsvp.promote({ actorAuthId: "admin-auth" }),
		).rejects.toMatchObject({ code: "INVALID_OPERATION" });

		await expect(
			hackkit.rsvp.cancel({
				actorAuthId: "admin-auth",
				targetAuthId: "first-auth",
			}),
		).resolves.toMatchObject({ status: "cancelled" });
		await expect(
			hackkit.rsvp.promote({ actorAuthId: "admin-auth" }),
		).resolves.toMatchObject({
			authId: "second-auth",
			status: "confirmed",
			promotedByAuthId: "admin-auth",
		});
		await expect(
			hackkit.notifications.listIntents({
				kind: CoreNotificationKind.RsvpPromoted,
			}),
		).resolves.toHaveLength(1);
	});
});
