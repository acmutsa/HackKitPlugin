import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "../testing.js";
import { describe, expect, it } from "vitest";
import { CoreNotificationKind, type NotificationChannel } from "../index.js";

describe("notifications", () => {
	it("queues typed core intents and reuses idempotent requests", async () => {
		const hackkit = await createTestHackkit();
		await createTestUser(hackkit, {
			authId: "hacker-auth",
			email: "hacker@example.com",
			firstName: "Test",
			lastName: "Hacker",
		});

		const intent = await hackkit.notifications.queueIntent({
			kind: CoreNotificationKind.UserApproved,
			recipientAuthId: "hacker-auth",
			payload: {
				authId: "hacker-auth",
				approvedByAuthId: "admin-auth",
			},
			idempotencyKey: "approval:hacker-auth",
		});
		const duplicate = await hackkit.notifications.queueIntent({
			kind: CoreNotificationKind.UserApproved,
			recipientAuthId: "hacker-auth",
			payload: { authId: "hacker-auth" },
			idempotencyKey: "approval:hacker-auth",
		});

		expect(duplicate.id).toBe(intent.id);
		expect(intent.status).toBe("pending");
		await expect(
			hackkit.notifications.queueIntent({
				kind: CoreNotificationKind.RsvpWaitlisted,
				payload: { position: 1 },
			}),
		).rejects.toThrow();
	});

	it("records one delivery attempt per channel and updates intent status", async () => {
		const hackkit = await createTestHackkit();
		await createTestUser(hackkit, {
			authId: "hacker-auth",
			email: "hacker@example.com",
			firstName: "Test",
			lastName: "Hacker",
		});
		const intent = await hackkit.notifications.queueIntent({
			kind: "sample.custom",
			payload: { authId: "hacker-auth" },
		});
		const channel: NotificationChannel = {
			id: "email",
			async deliver(deliveryIntent) {
				expect(deliveryIntent.id).toBe(intent.id);
				return {
					status: "delivered",
					provider: "test",
					recipient: "hacker@example.com",
					externalId: "message-1",
				};
			},
		};

		const result = await hackkit.notifications.deliverPending({
			channels: [channel],
		});

		expect(result.intentsProcessed).toBe(1);
		expect(result.attempts).toHaveLength(1);
		expect(result.attempts[0]).toMatchObject({
			channel: "email",
			status: "delivered",
			externalId: "message-1",
		});
		await expect(
			hackkit.notifications.getIntent(intent.id),
		).resolves.toMatchObject({
			status: "delivered",
		});
		await expect(
			hackkit.notifications.listDeliveryAttempts(intent.id),
		).resolves.toHaveLength(1);
	});
});

it("claims each pending intent once across concurrent delivery workers", async () => {
	const hackkit = await createTestHackkit();
	const intent = await hackkit.notifications.queueIntent({
		kind: "test.delivery",
		payload: {},
	});
	let sends = 0;
	const channels = [
		{
			id: "test",
			async deliver() {
				sends++;
				return { status: "delivered" as const };
			},
		},
	];
	const results = await Promise.all(
		[1, 2].map(() =>
			hackkit.runtime
				.createScope()
				.hackkit.notifications.deliverPending({ channels }),
		),
	);
	expect(sends).toBe(1);
	expect(
		results.reduce((sum, result) => sum + result.intentsProcessed, 0),
	).toBe(1);
	const fresh = hackkit.runtime.createScope().hackkit;
	expect(
		await fresh.notifications.listDeliveryAttempts(intent.id),
	).toHaveLength(1);
	expect(await fresh.notifications.getIntent(intent.id)).toMatchObject({
		status: "delivered",
	});
});
