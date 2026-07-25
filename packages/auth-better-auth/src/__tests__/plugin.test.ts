import { createInMemoryDatabaseAdapter, type User } from "@hackkit/core";
import { betterAuth } from "better-auth";
import { getTestInstance } from "better-auth/test";
import { describe, expect, it } from "vitest";
import { bindHackkitCallIdentity, hackkit } from "../index";

describe("hackkit Better Auth plugin", () => {
	it("installs the complete HackKit runtime into Better Auth context", async () => {
		const plugin = hackkit({
			database: createInMemoryDatabaseAdapter(),
		});

		expect(plugin.id).toBe("hackkit");
		expect(plugin.endpoints.getHackkitCurrentUser.path).toBe(
			"/hackkit/current-user",
		);
		expect("schema" in plugin).toBe(false);

		const auth = betterAuth({
			baseURL: "http://localhost:3000",
			secret: "hackkit-plugin-test-secret-at-least-32-chars",
			plugins: [plugin],
		});
		const context = await auth.$context;

		expect(auth.api.getHackkitCurrentUser).toBeTypeOf("function");
		expect(auth.api.callHackkit).toBeTypeOf("function");
		expect(context.hackkit.api.events.listEvents).toBeTypeOf("function");
		expect(
			Object.keys(context.hackkit.api.registry.storage.models),
		).toEqual(expect.arrayContaining(["user", "role", "event"]));

		const events = await auth.api.callPublicHackkit({
			body: { path: "events.listEvents", args: [] },
		});
		expect(events).toEqual({ data: [] });
		await expect(
			auth.api.callPublicHackkit({
				body: { path: "settings.set", args: [] },
			}),
		).rejects.toThrow("requires authentication");
	});

	it("binds authenticated calls to the session identity", () => {
		expect(
			bindHackkitCallIdentity(
				"events.createEvent",
				[{ actorAuthId: "spoofed", title: "Opening" }],
				"session-user",
			),
		).toEqual([
			{
				actorAuthId: "session-user",
				authId: "session-user",
				title: "Opening",
			},
		]);
		expect(
			bindHackkitCallIdentity(
				"hackers.getHacker",
				["spoofed"],
				"session-user",
			),
		).toEqual(["session-user"]);
		expect(
			bindHackkitCallIdentity(
				"admin.listRoles",
				["spoofed-admin"],
				"session-user",
			),
		).toEqual(["session-user"]);
	});

	it("executes authenticated domain calls through the Better Auth session", async () => {
		const plugin = hackkit({
			database: createInMemoryDatabaseAdapter(),
		});
		const { auth, signInWithTestUser } = await getTestInstance({
			plugins: [plugin],
		});
		const { headers, user } = await signInWithTestUser();

		const result = await auth.api.callHackkit({
			headers,
			body: { path: "users.getUser", args: ["spoofed-user"] },
		});

		expect(result.data).toMatchObject({
			authId: user.id,
			email: user.email,
		});
	});

	it("resolves the current HackKit user from a Better Auth user", async () => {
		const plugin = hackkit({
			database: createInMemoryDatabaseAdapter(),
			clock: () => new Date("2026-07-25T12:00:00.000Z"),
		});

		const auth = betterAuth({
			baseURL: "http://localhost:3000",
			secret: "hackkit-plugin-test-secret-at-least-32-chars",
			plugins: [plugin],
		});
		const context = await auth.$context;

		const user = await context.hackkit.getCurrentUser({
			id: "auth-user-1",
			email: "josh@example.com",
			name: "Josh Silva",
			image: "https://example.com/josh.png",
		});

		expect(user).toEqual<User>({
			authId: "auth-user-1",
			email: "josh@example.com",
			firstName: "Josh",
			lastName: "Silva",
			profilePhotoUrl: "https://example.com/josh.png",
			skills: [],
			isProfileSearchable: true,
			isApproved: false,
			createdAt: new Date("2026-07-25T12:00:00.000Z"),
			updatedAt: new Date("2026-07-25T12:00:00.000Z"),
		});
	});
});
