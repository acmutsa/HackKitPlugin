import { describe, expect, it } from "vitest";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { LibSqlDriver } from "@mikro-orm/libsql";
import { AuthUser, authEntities } from "./auth-entities.js";
import { createHackKitAuth } from "./auth.js";
import { HackKitProfile } from "./profile.js";

describe.each([
	[
		"SQLite",
		() =>
			MikroORM.init({
				driver: SqliteDriver,
				dbName: ":memory:",
				entities: [...authEntities, HackKitProfile],
			}),
	],
	[
		"local libSQL",
		() =>
			MikroORM.init({
				driver: LibSqlDriver,
				dbName: ":memory:",
				entities: [...authEntities, HackKitProfile],
			}),
	],
])("Better Auth MikroORM integration on %s", (_name, open) => {
	it("persists signup and session with a request-scoped manager", async () => {
		const orm = await open();
		try {
			await orm.schema.create();
			const auth = createHackKitAuth(orm, {
				secret: "test-secret-that-is-at-least-32-characters",
				baseURL: "http://localhost:3000",
				emailAndPassword: { enabled: true },
			});
			await RequestContext.create(orm.em, async () => {
				const result = await auth.api.signUpEmail({
					body: {
						name: "Example User",
						email: "example@example.com",
						password: "correct horse battery staple",
					},
					asResponse: true,
				});
				expect(result.status).toBe(200);
				const cookie = result.headers.get("set-cookie");
				expect(cookie).toContain("better-auth.session_token");
				const session = await auth.api.getSession({
					headers: new Headers({ cookie: cookie ?? "" }),
				});
				expect(session?.user.email).toBe("example@example.com");
			});
			const users = await orm.em.fork().find(AuthUser, {});
			expect(users).toHaveLength(1);
			const em = orm.em.fork();
			const profile = await em.findOneOrFail(HackKitProfile, {
				authId: users[0].id,
			});
			profile.hackTag = "example";
			await em.persist(profile).flush();
			expect(
				(
					await em
						.fork()
						.findOneOrFail(HackKitProfile, { hackTag: "example" })
				).skills,
			).toEqual([]);
			const duplicateManager = em.fork();
			await expect(
				duplicateManager
					.persist(
						duplicateManager.create(HackKitProfile, {
							authId: users[0].id,
							firstName: "Duplicate",
							lastName: "User",
						}),
					)
					.flush(),
			).rejects.toThrow();
			await expect(
				em.transactional(async (transaction) => {
					const value = await transaction.findOneOrFail(
						HackKitProfile,
						{ hackTag: "example" },
					);
					value.bio = "rolled back";
					await transaction.flush();
					throw new Error("abort");
				}),
			).rejects.toThrow("abort");
			expect(
				(
					await em
						.fork()
						.findOneOrFail(HackKitProfile, { hackTag: "example" })
				).bio,
			).toBeNull();
			expect(await orm.schema.getUpdateSchemaSQL()).toBe("");
		} finally {
			await orm.close();
		}
	});
});
