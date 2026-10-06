import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDatabaseCommand } from "../../scripts/database";
import { initializeHackkit } from "@hackkit/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { expect, it } from "vitest";
import appConfig from "../../hackkit.config";

it("runs Core, plugins, and Better Auth against committed app migrations", async () => {
	const directory = await mkdtemp(join(tmpdir(), "hackkit-web-db-"));
	const config = {
		...appConfig,
		database: {
			...appConfig.database,
			driver: SqliteDriver,
			dbName: join(directory, "web.db"),
			clientUrl: undefined,
			migrations: {
				path: join(process.cwd(), "db/migrations/sqlite"),
				snapshotOnMigrate: false,
			},
		},
		auth: {
			baseURL: "http://localhost:3000",
			secret: "database-workflow-test-secret-at-least-32-characters",
			emailAndPassword: { enabled: true },
		},
		logger: { disabled: true },
	};
	try {
		await runDatabaseCommand(config, { command: "migrate" });
		await runDatabaseCommand(config, { command: "seed" });
		const core = await initializeHackkit(config);
		try {
			expect(await core.orm.schema.getUpdateSchemaSQL()).toBe("");
			const scope = core.createScope();
			expect(await scope.hackkit.roles.listRoles()).toMatchObject([
				{ id: "core.owner" },
				{ id: "core.participant" },
			]);
			const signup = await core.auth.api.signUpEmail({
				body: {
					name: "Schema Test",
					email: "schema@example.com",
					password: "correct-horse-battery-staple",
				},
				returnHeaders: true,
			});
			const cookie = signup.headers.get("set-cookie");
			expect(cookie).toContain("better-auth.session_token=");
			const session = await core.auth.api.getSession({
				headers: new Headers({ cookie: cookie ?? "" }),
			});
			expect(session?.user.email).toBe("schema@example.com");
			expect(
				await scope.hackkit.users.getUser(signup.response.user.id),
			).toMatchObject({
				authId: signup.response.user.id,
				name: "Schema Test",
				email: "schema@example.com",
			});
		} finally {
			await core.orm.close();
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
