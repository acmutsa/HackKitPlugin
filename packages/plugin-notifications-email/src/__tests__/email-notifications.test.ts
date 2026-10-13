import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "@hackkit/core/testing";
import { describe, expect, it } from "vitest";
import { CoreNotificationKind } from "@hackkit/core";
import {
	emailNotificationsPlugin,
	type EmailMessage,
	type EmailNotificationsApi,
} from "../index";

async function createEmailHackkit() {
	const sent: EmailMessage[] = [];
	const plugin = emailNotificationsPlugin({
		from: "HackKit <hello@example.com>",
		appName: "HackKit Test",
		baseUrl: "https://example.com",
		provider: {
			id: "test",
			async send(message) {
				sent.push(message);
				return { id: "email-1" };
			},
		},
	});
	const hackkit = await createTestHackkit({
		plugins: [plugin],
	});
	return {
		hackkit,
		notificationsEmail: hackkit.plugins.notificationsEmail,
		sent,
	};
}

describe("email notifications plugin", () => {
	it("delivers pending intents to resolved user email addresses", async () => {
		const { hackkit, notificationsEmail, sent } =
			await createEmailHackkit();
		await createTestUser(hackkit, {
			authId: "hacker-auth",
			email: "hacker@example.com",
			name: "Hack Er",
		});
		const intent = await hackkit.notifications.queueIntent({
			kind: CoreNotificationKind.UserApproved,
			recipientAuthId: "hacker-auth",
			payload: { authId: "hacker-auth" },
		});

		const result = await notificationsEmail.deliverPending();

		expect(result.intentsProcessed).toBe(1);
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			to: "Hack Er <hacker@example.com>",
			subject: "You're approved for HackKit Test",
		});
		await expect(
			hackkit.notifications.listDeliveryAttempts(intent.id),
		).resolves.toMatchObject([
			expect.objectContaining({
				channel: "email",
				provider: "test",
				status: "delivered",
				recipient: "hacker@example.com",
			}),
		]);
	});
});

it("lazily resolves provider options once and skips them while disabled", async () => {
	let resolutions = 0;
	const plugin = emailNotificationsPlugin(() => {
		resolutions++;
		return {
			from: "HackKit <test@example.com>",
			baseUrl: "http://localhost:3000",
		};
	});
	const disabled = await createTestHackkit({
		plugins: [{ ...plugin, enabled: false }],
	});
	expect(disabled.isPluginEnabled("notificationsEmail")).toBe(false);
	expect(resolutions).toBe(0);
	const enabled = await createTestHackkit({ plugins: [plugin] });
	enabled.runtime.createScope();
	expect(enabled.isPluginEnabled("notificationsEmail")).toBe(true);
	expect(resolutions).toBe(1);
});
