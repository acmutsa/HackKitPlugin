import { expect } from "vitest";
import type { EventSubscriber, InferEntity } from "@mikro-orm/core";
import { HackKitUser, type HackKitRuntime } from "@hackkit/core";

function signal() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

async function within<T>(operation: Promise<T>, message: string) {
	let timer!: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), 3000);
	});
	try {
		return await Promise.race([operation, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

/** Exercise profile writes through Core while controlling transaction overlap. */
export async function verifyProfileConcurrency(
	runtime: HackKitRuntime,
	rowLocking: boolean,
) {
	const ids = [crypto.randomUUID(), crypto.randomUUID()];
	const seed = runtime.createScope().em;
	for (const id of ids) {
		seed.create(HackKitUser, {
			id,
			name: "Profile test",
			email: `${id}@example.com`,
		});
	}
	await seed.flush();
	let pause: ((id: string) => Promise<void>) | undefined;
	const subscriber: EventSubscriber<InferEntity<typeof HackKitUser>> = {
		async beforeUpdate({ entity, meta }) {
			if (meta.className === HackKitUser.meta.className) {
				await pause?.(entity.id);
			}
		},
	};
	runtime.orm.em.getEventManager().registerSubscriber(subscriber);
	try {
		if (rowLocking) {
			const entered = signal();
			const release = signal();
			pause = async (id) => {
				if (id === ids[0]) {
					entered.resolve();
					await release.promise;
				}
			};
			const first = runtime.createScope().hackkit.users.claimHackTag({
				authId: ids[0],
				hackTag: "independent-profile",
			});
			let second: Promise<unknown> | undefined;
			try {
				await within(
					Promise.race([
						entered.promise,
						first.then(() => {
							throw new Error(
								"The first profile write did not pause.",
							);
						}),
					]),
					"The first profile write did not start.",
				);
				second = runtime.createScope().hackkit.users.updateProfile({
					authId: ids[1],
					bio: "Independent update",
				});
				await expect(
					within(second, "An unrelated profile was blocked."),
				).resolves.toMatchObject({
					bio: "Independent update",
				});
			} finally {
				pause = undefined;
				release.resolve();
				await Promise.allSettled([first, ...(second ? [second] : [])]);
			}
			await expect(first).resolves.toMatchObject({
				hackTag: "independent-profile",
			});
		}

		// Both entry points must preserve changes to different fields of one user.
		await Promise.all([
			runtime.createScope().hackkit.users.claimHackTag({
				authId: ids[0],
				hackTag: "consistent-profile",
			}),
			runtime.createScope().hackkit.users.updateProfile({
				authId: ids[0],
				bio: "Concurrent profile update",
			}),
		]);
		await expect(
			runtime.createScope().hackkit.users.getUser(ids[0]),
		).resolves.toMatchObject({
			hackTag: "consistent-profile",
			bio: "Concurrent profile update",
		});

		const previous = await Promise.all(
			ids.map((id) => runtime.createScope().hackkit.users.getUser(id)),
		);
		if (rowLocking) {
			// Let both transactions pass the availability check before either writes.
			const ready = signal();
			let arrivals = 0;
			pause = async (id) => {
				if (!ids.includes(id)) return;
				if (++arrivals === 2) ready.resolve();
				await within(
					ready.promise,
					"The competing claims did not overlap.",
				);
			};
		}
		const claims = await Promise.allSettled(
			ids.map((authId) =>
				runtime.createScope().hackkit.users.updateProfile({
					authId,
					hackTag: "SAME-TAG",
					bio: "Winning claim",
				}),
			),
		);
		pause = undefined;
		expect(
			claims.filter((claim) => claim.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			claims.find((claim) => claim.status === "rejected"),
		).toMatchObject({
			reason: { code: "CONFLICT" },
		});
		for (const [index, claim] of claims.entries()) {
			await expect(
				runtime.createScope().hackkit.users.getUser(ids[index]),
			).resolves.toMatchObject(
				claim.status === "fulfilled"
					? { hackTag: "same-tag", bio: "Winning claim" }
					: {
							hackTag: previous[index]?.hackTag,
							bio: previous[index]?.bio,
						},
			);
		}
	} finally {
		pause = undefined;
		await runtime
			.createScope()
			.em.nativeDelete(HackKitUser, { id: { $in: ids } });
	}
}
