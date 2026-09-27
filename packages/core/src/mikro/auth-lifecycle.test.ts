import { MikroORM } from "@mikro-orm/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { describe, expect, it } from "vitest";
import { createHackKitAuth } from "./auth.js";
import {
	authEntities,
	AuthUser,
	AuthSession,
	AuthAccount,
} from "./auth-entities.js";
import { HackKitProfile } from "./profile.js";

describe("Core auth lifecycle", () => {
	it("rolls back the identity and profile if signup fails", async () => {
		const orm = await MikroORM.init({
			driver: SqliteDriver,
			dbName: ":memory:",
			entities: [...authEntities, HackKitProfile],
		});
		try {
			await orm.schema.create();
			let profileExistsBeforeAccount = false;
			const auth = createHackKitAuth(orm, {
				secret: "local-test-secret-with-at-least-32-characters",
				baseURL: "http://localhost:3000",
				emailAndPassword: { enabled: true },
				databaseHooks: {
					account: {
						create: {
							before: async () => {
								profileExistsBeforeAccount =
									(await orm.em.count(HackKitProfile)) === 1;
								throw new Error("Reject account");
							},
						},
					},
				},
			});
			await expect(
				auth.api.signUpEmail({
					body: {
						email: "rejected@example.com",
						name: "Rejected User",
						password: "a sufficiently long password",
					},
					asResponse: true,
				}),
			).rejects.toThrow("Reject account");
			expect(profileExistsBeforeAccount).toBe(true);
			expect(await orm.em.fork().count(AuthUser)).toBe(0);
			expect(await orm.em.fork().count(HackKitProfile)).toBe(0);
		} finally {
			await orm.close();
		}
	});

	it("creates a profile on signup and preserves edits when reading sessions", async () => {
		const orm = await MikroORM.init({
			driver: SqliteDriver,
			dbName: ":memory:",
			entities: [...authEntities, HackKitProfile],
		});
		try {
			await orm.schema.create();
			const auth = createHackKitAuth(orm, {
				secret: "local-test-secret-with-at-least-32-characters",
				baseURL: "http://localhost:3000",
				emailAndPassword: { enabled: true },
			});
			const signup = await auth.api.signUpEmail({
				body: {
					email: "josh@example.com",
					name: "Josh Silva",
					password: "a sufficiently long password",
				},
				asResponse: true,
			});
			expect(signup.status).toBe(200);
			const headers = new Headers({
				cookie: signup.headers.get("set-cookie") ?? "",
			});
			const session = await auth.api.getSession({ headers });
			expect(session?.user.email).toBe("josh@example.com");
			const em = orm.em.fork();
			const profile = await em.findOneOrFail(HackKitProfile, {
				authId: session!.user.id,
			});
			expect(profile.firstName).toBe("Josh");
			expect(profile.lastName).toBe("Silva");
			profile.firstName = "Joshua";
			await em.flush();
			await auth.api.getSession({ headers });
			expect(
				(
					await em.fork().findOneOrFail(HackKitProfile, {
						authId: session!.user.id,
					})
				).firstName,
			).toBe("Joshua");
			await em
				.remove(
					await em.findOneOrFail(AuthUser, { id: session!.user.id }),
				)
				.flush();
			expect(await em.fork().count(HackKitProfile)).toBe(0);
			expect(await em.fork().count(AuthSession)).toBe(0);
			expect(await em.fork().count(AuthAccount)).toBe(0);
		} finally {
			await orm.close();
		}
	});
});
