import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "../testing.js";
import { describe, expect, it } from "vitest";
import { CorePermission } from "../permissions.js";
import { seedTestOwner } from "./seed-test-owner.js";

describe("hackkit access control and check-in", () => {
	it("records hackathon check-in once", async () => {
		const hackkit = await createTestHackkit();
		await seedTestOwner(hackkit, "volunteer-auth");
		await createTestUser(hackkit, {
			authId: "participant-auth",
			email: "p@example.com",
			name: "Pat Participant",
		});

		const checkedIn = await hackkit.users.checkIn({
			actorAuthId: "volunteer-auth",
			targetAuthId: "participant-auth",
		});
		expect(checkedIn.checkedInAt).toBeTruthy();

		await expect(
			hackkit.users.checkIn({
				actorAuthId: "volunteer-auth",
				targetAuthId: "participant-auth",
			}),
		).rejects.toMatchObject({ code: "INVALID_OPERATION" });
	});

	it("records event scans as separate rows", async () => {
		const hackkit = await createTestHackkit();
		await seedTestOwner(hackkit, "volunteer-auth");
		await createTestUser(hackkit, {
			authId: "participant-auth",
			email: "p@example.com",
			name: "Pat Participant",
		});

		const event = await hackkit.events.createEvent({
			actorAuthId: "volunteer-auth",
			title: "Lunch",
			description: "Food",
			startTime: new Date("2026-05-24T13:00:00.000Z"),
			endTime: new Date("2026-05-24T14:00:00.000Z"),
			location: "Hall",
			type: "meal",
			hidden: false,
		});

		const first = await hackkit.events.recordEventScan({
			actorAuthId: "volunteer-auth",
			eventId: event.id,
			targetAuthId: "participant-auth",
		});
		expect(first.hadPriorScans).toBe(false);

		const second = await hackkit.events.recordEventScan({
			actorAuthId: "volunteer-auth",
			eventId: event.id,
			targetAuthId: "participant-auth",
		});
		expect(second.hadPriorScans).toBe(true);
		expect(second.priorScans).toHaveLength(1);
	});

	it("enforces permissions through accessControl", async () => {
		const hackkit = await createTestHackkit();
		await createTestUser(hackkit, {
			authId: "no-role-auth",
			email: "n@example.com",
			name: "No Role",
		});

		await expect(
			hackkit.accessControl.requirePermission(
				"no-role-auth",
				CorePermission.UsersCheckIn,
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
