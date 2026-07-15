import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHackkit } from "@hackkit/core";
import { createDrizzleLibsqlAdapter } from "@hackkit/db-drizzle/libsql";
import { createClient } from "@libsql/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { appJob } from "./fixtures/app-schema";
import { account, session, user, verification } from "../schema/auth";

const clients: ReturnType<typeof createClient>[] = [];

afterEach(() => {
	for (const client of clients.splice(0)) client.close();
});

describe("committed web database workflow", () => {
	it("runs Better Auth against its generated schema after app migrations", async () => {
		const client = createClient({ url: ":memory:" });
		clients.push(client);
		const db = drizzle(client);
		await migrate(db, {
			migrationsFolder: join(process.cwd(), "db/migrations"),
		});
		await client.executeMultiple(
			await readFile(
				join(process.cwd(), "db/__tests__/fixtures/app-migration.sql"),
				"utf8",
			),
		);

		const hackkit = createHackkit({
			database: createDrizzleLibsqlAdapter(db),
			clock: () => new Date("2026-07-14T12:00:00.000Z"),
			seedRoles: [
				{
					id: "test.role",
					name: "Test role",
					position: 1,
					permissions: [],
				},
			],
		});
		await hackkit.init();
		await expect(hackkit.roles.listRoles()).resolves.toMatchObject([
			{ id: "test.role", name: "Test role" },
		]);

		await db.insert(appJob).values({ id: "job-1", status: "ready" });
		await expect(db.select().from(appJob)).resolves.toEqual([
			{ id: "job-1", status: "ready" },
		]);

		const auth = betterAuth({
			baseURL: "http://localhost:3000",
			secret: "database-workflow-test-secret-at-least-32-characters",
			database: drizzleAdapter(db, {
				provider: "sqlite",
				schema: { user, session, account, verification },
				camelCase: true,
			}),
			emailAndPassword: { enabled: true },
			rateLimit: { enabled: false },
		});

		const signup = await auth.api.signUpEmail({
			body: {
				name: "Schema Test",
				email: "schema@example.com",
				password: "correct-horse-battery-staple",
			},
			returnHeaders: true,
		});
		expect(signup.response.user.email).toBe("schema@example.com");

		const setCookie = signup.headers.get("set-cookie");
		expect(setCookie).toContain("better-auth.session_token=");
		const cookie = setCookie?.split(";", 1)[0];
		const currentSession = await auth.api.getSession({
			headers: new Headers({ cookie: cookie ?? "" }),
		});

		expect(currentSession?.user.email).toBe("schema@example.com");
	});
});
