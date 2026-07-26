import { betterAuth } from "better-auth";
import { getTestInstance } from "better-auth/test";
import { defineModel, field, type HackKitPlugin } from "@hackkit/core";
import { teamsPlugin } from "@hackkit/plugin-teams";
import { describe, expect, it } from "vitest";
import { hackkitClient } from "../client";
import { hackkit } from "../index";

describe("native HackKit Better Auth plugin", () => {
	it("contributes HackKit fields and models to Better Auth's schema", () => {
		const plugin = hackkit();

		expect(plugin.schema.user?.fields).toMatchObject({
			firstName: { type: "string", required: false },
			hackTag: { type: "string", unique: true },
			isApproved: { type: "boolean", required: true },
		});
		expect(plugin.schema.coreEvent?.fields).toMatchObject({
			title: { type: "string", required: true },
			hidden: { type: "boolean", required: true },
		});
		expect(plugin.schema.coreEvent?.fields.id).toBeUndefined();
	});

	it("exposes explicit endpoints instead of a generic RPC or runtime context", async () => {
		const plugin = hackkit();
		const auth = betterAuth({
			baseURL: "http://localhost:3000",
			secret: "hackkit-plugin-test-secret-at-least-32-chars",
			plugins: [plugin],
		});

		expect(auth.api.getHackkitMe).toBeTypeOf("function");
		expect(auth.api.claimHackkitTag).toBeTypeOf("function");
		expect(auth.api.listHackkitEvents).toBeTypeOf("function");
		expect("createHackkitTeam" in auth.api).toBe(false);
		expect("callHackkit" in auth.api).toBe(false);
		expect("hackkit" in (await auth.$context)).toBe(false);
	});

	it("stores HackKit profile state on the Better Auth user", async () => {
		const { auth, signInWithTestUser } = await getTestInstance({
			plugins: [hackkit()],
		});
		const { headers, user } = await signInWithTestUser();

		await auth.api.claimHackkitTag({
			headers,
			body: { hackTag: "native-plugin" },
		});
		const profile = await auth.api.getHackkitMe({ headers });

		expect(profile).toMatchObject({
			authId: user.id,
			email: user.email,
			hackTag: "native-plugin",
			skills: [],
		});
	});

	it("serves public domain reads through named endpoints", async () => {
		const { auth } = await getTestInstance({ plugins: [hackkit()] });

		await expect(auth.api.listHackkitEvents()).resolves.toEqual([]);
	});

	it("keeps Better Auth name synchronized across partial profile updates", async () => {
		const { auth, signInWithTestUser } = await getTestInstance({
			plugins: [hackkit()],
		});
		const { headers } = await signInWithTestUser();
		const before = await auth.api.getHackkitMe({ headers });

		await auth.api.updateHackkitProfile({
			headers,
			body: { firstName: "Ada" },
		});

		const [profile, session] = await Promise.all([
			auth.api.getHackkitMe({ headers }),
			auth.api.getSession({ headers }),
		]);
		expect(profile.lastName).toBe(before.lastName);
		expect(session?.user.name).toBe(`Ada ${before.lastName}`);
	});

	it("folds installed HackKit extensions into Better Auth schema and endpoints", async () => {
		const plugin = hackkit({ plugins: [teamsPlugin()] });

		expect(plugin.schema.teamsTeam).toBeDefined();
		expect(plugin.endpoints.createHackkitTeam).toBeDefined();
		expect(plugin.endpoints.listPendingHackkitTeamInvites).toBeDefined();

		const { auth, signInWithTestUser } = await getTestInstance({
			plugins: [plugin],
		});
		const { headers } = await signInWithTestUser();
		await expect(
			auth.api.listPendingHackkitTeamInvites({ headers }),
		).resolves.toEqual([]);
	});

	it("provides an inference companion for createAuthClient", () => {
		const clientPlugin = hackkitClient();

		expect(clientPlugin.id).toBe("hackkit");
		expect(clientPlugin.$InferServerPlugin).toBeDefined();
	});

	it("rejects model keys that collide after Better Auth name conversion", () => {
		const plugins: HackKitPlugin[] = [
			{
				id: "foo",
				models: {
					first: defineModel("foo.barBaz", {
						fields: { id: field.string().primaryKey() },
					}),
				},
			},
			{
				id: "fooBar",
				models: {
					second: defineModel("fooBar.baz", {
						fields: { id: field.string().primaryKey() },
					}),
				},
			},
		];

		expect(() => hackkit({ plugins })).toThrow(
			/both map to Better Auth model/,
		);
	});
});
