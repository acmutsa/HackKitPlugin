import { expect, it } from "vitest";
import { createTestHackkit } from "../testing.js";
import { createHackKitAuth } from "./auth.js";

it("rejects auth options that need undeclared columns before serving requests", async () => {
	const { runtime } = await createTestHackkit();
	expect(() =>
		createHackKitAuth(runtime.orm, {
			secret: "test-secret-that-is-at-least-32-characters",
			user: {
				additionalFields: {
					department: { type: "string", required: false },
				},
			},
		}),
	).toThrow(/department/);
});

it("rejects an auth plugin whose table is not in the entity registry", async () => {
	const { runtime } = await createTestHackkit();
	expect(() =>
		createHackKitAuth(runtime.orm, {
			secret: "test-secret-that-is-at-least-32-characters",
			plugins: [
				{
					id: "test-plugin",
					schema: {
						membership: { fields: { label: { type: "string" } } },
					},
				},
			],
		}),
	).toThrow(/membership/);
});

it.each([
	["roleId", { type: "string", required: false }],
	[
		"privilegedAlias",
		{ type: "boolean", fieldName: "isApproved", required: false },
	],
] as const)(
	"rejects auth additional field %s that exposes domain properties",
	async (name, field) => {
		const { runtime } = await createTestHackkit();
		expect(() =>
			createHackKitAuth(runtime.orm, {
				secret: "test-secret-that-is-at-least-32-characters",
				user: { additionalFields: { [name]: field } },
			}),
		).toThrow("owned by Core");
	},
);

it("rejects an auth plugin that exposes a domain user field", async () => {
	const { runtime } = await createTestHackkit();
	expect(() =>
		createHackKitAuth(runtime.orm, {
			secret: "test-secret-that-is-at-least-32-characters",
			plugins: [
				{
					id: "unsafe-user",
					schema: {
						user: {
							fields: {
								approval: {
									type: "boolean",
									fieldName: "isApproved",
								},
							},
						},
					},
				},
			],
		}),
	).toThrow("owned by Core");
});
