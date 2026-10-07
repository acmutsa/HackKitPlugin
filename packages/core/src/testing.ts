import { afterEach } from "vitest";
import { SqliteDriver } from "@mikro-orm/sqlite";
import {
	initializeHackkit,
	type InitializeHackkitOptions,
	type HackKitScope,
	type HackKitRuntime,
} from "./mikro/runtime";
import { HackKitUser } from "./models";
import type { HackKitPlugin } from "./plugins";
import type { EntityManager } from "@mikro-orm/core";

const cleanups = new Set<() => Promise<void>>();
afterEach(async () => {
	await Promise.all([...cleanups].map((close) => close()));
	cleanups.clear();
});

/** A real, isolated SQLite database for tests of Core and server plugins. */
export async function createTestHackkit<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(
	options: Omit<InitializeHackkitOptions<TPlugins>, "database" | "auth"> = {},
): Promise<TestHackkit<TPlugins>> {
	let sequence = 0;
	let tick = 0;
	const runtime = await initializeHackkit({
		clock: () => new Date(Date.UTC(2026, 4, 24, 12) + tick++ * 1000),
		id: () => `id-${++sequence}`,
		logger: { disabled: true },
		...options,
		database: { driver: SqliteDriver, dbName: ":memory:" },
		auth: {
			secret: "test-secret-that-is-at-least-32-characters",
			baseURL: "http://localhost:3000",
			emailAndPassword: { enabled: true },
		},
	});
	cleanups.add(() => runtime.orm.close());
	await runtime.orm.schema.create();
	const scope = runtime.createScope();
	return Object.assign(scope.hackkit, { em: scope.em, runtime });
}

/** Seed a known identity without hashing a password in every domain test. */
export async function createTestUser(
	context: { em: EntityManager },
	input: {
		authId: string;
		email: string;
		name: string;
		profilePhotoUrl?: string;
	},
) {
	context.em.create(HackKitUser, {
		id: input.authId,
		email: input.email,
		name: input.name,
		profilePhotoUrl: input.profilePhotoUrl,
		createdAt: new Date("2026-05-24T12:00:00.000Z"),
		updatedAt: new Date("2026-05-24T12:00:00.000Z"),
	});
	await context.em.flush();
}

export type TestHackkit<TPlugins extends readonly HackKitPlugin[] = []> =
	HackKitScope<TPlugins>["hackkit"] & {
		em: EntityManager;
		runtime: HackKitRuntime<TPlugins>;
	};
