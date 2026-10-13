import { MikroORM } from "@mikro-orm/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { describe, expect, it } from "vitest";
import { createHackKitAuth } from "./auth";
import { authEntities, AuthSession, AuthAccount } from "./auth-entities";
import { coreModels, HackKitUser } from "../models";
import { createHackkit } from "../hackkit";

const options = {
	secret: "local-test-secret-with-at-least-32-characters",
	baseURL: "http://localhost:3000",
	emailAndPassword: { enabled: true },
	user: { deleteUser: { enabled: true } },
	logger: { disabled: true },
};
const signupBody = {
	email: "josh@example.com",
	name: "Josh Silva",
	password: "a sufficiently long password",
};
async function open() {
	const orm = await MikroORM.init({
		driver: SqliteDriver,
		dbName: ":memory:",
		entities: [...authEntities, ...Object.values(coreModels)],
	});
	await orm.schema.create();
	return orm;
}

describe("Core auth lifecycle", () => {
	it("rolls back the single user row when account creation rejects signup", async () => {
		const orm = await open();
		try {
			let userExistsBeforeAccount = false;
			const auth = createHackKitAuth(orm, {
				...options,
				databaseHooks: {
					account: {
						create: {
							before: async () => {
								userExistsBeforeAccount =
									(await orm.em.count(HackKitUser)) === 1;
								throw new Error("Reject account");
							},
						},
					},
				},
			});
			await expect(
				auth.api.signUpEmail({ body: signupBody }),
			).rejects.toThrow("Reject account");
			expect(userExistsBeforeAccount).toBe(true);
			const em = orm.em.fork({ useContext: true });
			expect(await em.count(HackKitUser)).toBe(0);
			expect(await em.count(AuthAccount)).toBe(0);
			expect(await em.count(AuthSession)).toBe(0);
		} finally {
			await orm.close();
		}
	});

	it("shares name, photo and email across auth and domain reads and deletes dependent records", async () => {
		const orm = await open();
		try {
			const auth = createHackKitAuth(orm, options);
			const signup = await auth.api.signUpEmail({
				body: signupBody,
				returnHeaders: true,
			});
			const headers = new Headers({
				cookie: signup.headers.get("set-cookie") ?? "",
			});
			const id = signup.response.user.id;
			const em = orm.em.fork({ useContext: true });
			const user = await em.findOneOrFail(HackKitUser, { id });
			expect(user).toMatchObject({
				name: signupBody.name,
				email: signupBody.email,
				roleId: null,
				isApproved: false,
				skills: [],
				checkedInAt: null,
			});
			expect(await em.count(HackKitUser)).toBe(1);
			expect(
				[...orm.getMetadata().getAll().values()].find(
					(entity) => entity.tableName === "user",
				),
			).toBeUndefined();
			const hackkit = createHackkit({ em, logger: { disabled: true } });
			await hackkit.users.updateProfile({
				authId: id,
				name: "Joshua Silva",
				profilePhotoUrl: "/api/files/view/avatar.png",
				bio: "Hello",
			});
			expect(
				(await auth.api.getSession({ headers }))?.user,
			).toMatchObject({
				id,
				name: "Joshua Silva",
				image: "/api/files/view/avatar.png",
			});
			await auth.api.updateUser({
				headers,
				body: { name: "Josh", image: "https://example.com/avatar.png" },
			});
			expect(
				await createHackkit({
					em: em.fork(),
					logger: { disabled: true },
				}).users.getUser(id),
			).toMatchObject({
				id,
				name: "Josh",
				profilePhotoUrl: "https://example.com/avatar.png",
				bio: "Hello",
			});
			const signin = await auth.api.signInEmail({
				body: {
					email: signupBody.email,
					password: signupBody.password,
				},
			});
			expect(signin.user.id).toBe(id);
			// Nullable audit references survive deletion; dependent domain data cascades.
			em.create(coreModels.userData, {
				authId: id,
				age: 21,
				gender: "x",
				race: "x",
				ethnicity: "x",
				shirtSize: "m",
				hasAcceptedMLHCodeOfConduct: true,
				hasSharedDataWithMLH: false,
				isEmailable: false,
			});
			em.create(coreModels.setting, {
				key: "test",
				value: true,
				createdByAuthId: id,
				updatedByAuthId: id,
			});
			await em.flush();
			await auth.api.deleteUser({
				headers,
				body: { password: signupBody.password },
			});
			const fresh = em.fork();
			expect(await fresh.count(HackKitUser)).toBe(0);
			expect(await fresh.count(AuthSession)).toBe(0);
			expect(await fresh.count(AuthAccount)).toBe(0);
			expect(await fresh.count(coreModels.userData)).toBe(0);
			expect(
				await fresh.findOneOrFail(coreModels.setting, { key: "test" }),
			).toMatchObject({ createdByAuthId: null, updatedByAuthId: null });
			expect(await auth.api.getSession({ headers })).toBeNull();
		} finally {
			await orm.close();
		}
	});

	it("ignores privileged fields in public signup and update payloads", async () => {
		const orm = await open();
		try {
			const auth = createHackKitAuth(orm, options);
			const attack = {
				roleId: "core.owner",
				isApproved: true,
				checkedInAt: new Date().toISOString(),
				hackTag: "stolen",
			};
			const post = (path: string, body: object, cookie = "") =>
				auth.handler(
					new Request(`http://localhost:3000/api/auth/${path}`, {
						method: "POST",
						headers: {
							"content-type": "application/json",
							origin: "http://localhost:3000",
							cookie,
						},
						body: JSON.stringify(body),
					}),
				);
			const signup = await post("sign-up/email", {
				...signupBody,
				...attack,
			});
			expect(signup.status).toBe(200);
			const cookie = signup.headers.get("set-cookie") ?? "";
			const session = await auth.api.getSession({
				headers: new Headers({ cookie }),
			});
			expect(
				(
					await post(
						"update-user",
						{ name: "Allowed", ...attack },
						cookie,
					)
				).status,
			).toBe(200);
			const em = orm.em.fork({ useContext: true });
			expect(
				await em.findOneOrFail(HackKitUser, { id: session!.user.id }),
			).toMatchObject({
				name: "Allowed",
				roleId: null,
				isApproved: false,
				checkedInAt: null,
				hackTag: null,
			});
			await createHackkit({
				em,
				logger: { disabled: true },
			}).users.updateProfile({
				authId: session!.user.id,
				bio: "Allowed",
				...attack,
			});
			expect(
				await em
					.fork()
					.findOneOrFail(HackKitUser, { id: session!.user.id }),
			).toMatchObject({
				bio: "Allowed",
				roleId: null,
				isApproved: false,
				checkedInAt: null,
			});
		} finally {
			await orm.close();
		}
	});

	it("verifies email on the canonical user before allowing verified signin", async () => {
		const orm = await open();
		try {
			let verificationUrl = "";
			const auth = createHackKitAuth(orm, {
				...options,
				emailAndPassword: {
					enabled: true,
					requireEmailVerification: true,
				},
				emailVerification: {
					sendOnSignUp: true,
					sendVerificationEmail: async ({ url }) => {
						verificationUrl = url;
					},
				},
			});
			const signup = await auth.api.signUpEmail({ body: signupBody });
			await expect(
				auth.api.signInEmail({
					body: {
						email: signupBody.email,
						password: signupBody.password,
					},
				}),
			).rejects.toMatchObject({ status: "FORBIDDEN" });
			await auth.api.verifyEmail({
				query: {
					token: new URL(verificationUrl).searchParams.get("token")!,
				},
			});
			expect(
				await orm.em
					.fork({ useContext: true })
					.findOneOrFail(HackKitUser, { id: signup.user.id }),
			).toMatchObject({ emailVerified: true });
			expect(
				(
					await auth.api.signInEmail({
						body: {
							email: signupBody.email,
							password: signupBody.password,
						},
					})
				).user.id,
			).toBe(signup.user.id);
		} finally {
			await orm.close();
		}
	});
});
