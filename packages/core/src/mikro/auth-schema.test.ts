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
