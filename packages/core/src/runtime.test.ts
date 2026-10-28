import { SqliteDriver } from "@mikro-orm/sqlite";
import { RequestContext } from "@mikro-orm/core";
import { expect, it } from "vitest";
import { initializeHackkit } from "./runtime";
import { coreModels } from "./models";
import type { HackKitPlugin } from "./plugins";

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

it("shares prepared configuration while isolating concurrent actors and managed entities", async () => {
	const plugins = [
		{ id: "probe", setup: (context) => context },
	] as const satisfies readonly HackKitPlugin[];
	const runtime = await initializeHackkit<typeof plugins>({
		database: { driver: SqliteDriver, dbName: ":memory:" },
		auth: { secret: "local-test-secret-with-at-least-32-characters" },
		logger: { disabled: true },
		groups: ["builders"],
		plugins,
	});
	try {
		await runtime.orm.schema.create();
		const first = runtime.createScope("first");
		const second = runtime.createScope("second");
		expect(first.hackkit.events.options).toBe(
			second.hackkit.events.options,
		);
		expect(first.hackkit.userData.options).toBe(
			second.hackkit.userData.options,
		);
		expect(first.hackkit.plugins.probe.groups).toBe(
			second.hackkit.plugins.probe.groups,
		);
		expect(first.hackkit.plugins.probe.em).toBe(first.em);
		expect(second.hackkit.plugins.probe.em).toBe(second.em);
		first.em.create(coreModels.user, {
			id: "participant",
			name: "Participant",
			email: "participant@example.com",
		});
		await first.em.flush();

		let arrive = () => {};
		const bothStarted = new Promise<void>((resolve) => {
			arrive = resolve;
		});
		let started = 0;
		const results = await Promise.all(
			["first", "second"].map((actor) =>
				runtime.run(async ({ em, hackkit }) => {
					if (++started === 2) arrive();
					await bothStarted;
					expect(RequestContext.getEntityManager()).toBe(em);
					expect(em.getContext()).toBe(em);
					expect(hackkit.plugins.probe.em).toBe(em);
					expect(hackkit.plugins.probe.actorAuthId).toBe(actor);
					const user = await em.findOneOrFail(coreModels.user, {
						id: "participant",
					});
					user.name = actor;
					await Promise.resolve();
					expect(user.name).toBe(actor);
					return { em, user };
				}, actor),
			),
		);
		expect(results[0]?.em).not.toBe(results[1]?.em);
		expect(results[0]?.user).not.toBe(results[1]?.user);
		expect(
			(
				await second.em.findOneOrFail(coreModels.user, {
					id: "participant",
				})
			).name,
		).toBe("Participant");
	} finally {
		await runtime.orm.close();
	}
});
