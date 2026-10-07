import { SqliteDriver } from "@mikro-orm/sqlite";
import { expect, it } from "vitest";
import { initializeHackkit } from "./runtime";

it("shares auth and connections while isolating domain execution scopes", async () => {
	const runtime = await initializeHackkit({
		database: { driver: SqliteDriver, dbName: ":memory:" },
		auth: {
			secret: "local-test-secret-with-at-least-32-characters",
			baseURL: "http://localhost:3000",
			emailAndPassword: { enabled: true },
		},
	});
	try {
		await runtime.orm.schema.create();
		const signedUp = await runtime.auth.api.signUpEmail({
			body: {
				email: "participant@example.com",
				name: "Participant One",
				password: "a sufficiently long password",
			},
		});
		const first = runtime.createScope();
		const second = runtime.createScope();
		expect(first.em).not.toBe(second.em);
		await first.hackkit.users.claimHackTag({
			authId: signedUp.user.id,
			hackTag: "participant",
		});
		await first.hackkit.users.updateProfile({
			authId: signedUp.user.id,
			bio: "Building useful things",
		});
		const profile = await second.hackkit.users.getUser(signedUp.user.id);
		expect(profile).toMatchObject({
			id: signedUp.user.id,
			email: "participant@example.com",
			hackTag: "participant",
			bio: "Building useful things",
		});
		expect(Object.getPrototypeOf(profile)).toBe(Object.prototype);
	} finally {
		await runtime.orm.close();
	}
});
