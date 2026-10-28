import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { templates, testEnvironment } from "../support/templates.mjs";
import { prepareMigrationDirectory } from "../support/migrations.mjs";
import { loadHackkitConfig } from "@hackkit/config";
import { initializeHackkit } from "@hackkit/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { runDatabaseCommand } from "../../templates/nextjs-minimal/scripts/database";

const execute = promisify(execFile);
for (const template of Object.values(templates)) {
	it(`${template.id}: app commands isolate storage, sync without connecting, and enforce reset restrictions`, async () => {
		const directory = await mkdtemp(
			join(tmpdir(), `hackkit-commands-${template.id}-`),
		);
		const env = {
			...testEnvironment(template, directory),
			NODE_ENV: "test",
		};
		const run = (args: string[], overrides: NodeJS.ProcessEnv = {}) =>
			execute(process.execPath, args, {
				cwd: template.directory,
				env: { ...env, ...overrides },
				timeout: 30000,
			});
		const command = (name: string, overrides: NodeJS.ProcessEnv = {}) =>
			run(["scripts/db.mjs", name], overrides);
		try {
			await prepareMigrationDirectory(directory);
			const syncDatabase = join(directory, "sync-must-not-connect.db");
			await run(
				["node_modules/@hackkit/cli/bin/hackkit.mjs", "plugin", "sync"],
				{ DATABASE_URL: `file:${syncDatabase}` },
			);
			await expect(access(syncDatabase)).rejects.toMatchObject({
				code: "ENOENT",
			});
			const generated: unknown = JSON.parse(
				(await command("generate")).stdout,
			);
			expect(generated).toMatchObject({
				command: "generate",
				migration: { code: expect.stringContaining("core_user") },
			});
			expect(generated).toMatchObject({
				migration: {
					code:
						template.id === "full"
							? expect.stringContaining("teams_team")
							: expect.not.stringContaining("teams_team"),
				},
			});
			await access(join(directory, "migrations/.snapshot.json"));
			const status = await command("status");
			expect(JSON.parse(status.stdout)).toMatchObject({
				executed: [],
				pending: [expect.anything()],
			});
			const resultPath = join(directory, "unmigrated.json");
			await expect(
				run(["scripts/db.mjs", "check", "--output", resultPath]),
			).rejects.toMatchObject({ code: 1 });
			expect(
				JSON.parse(await readFile(resultPath, "utf8")),
			).toMatchObject({
				ok: false,
				needsMigration: false,
				schemaSql: expect.stringContaining("core_user"),
			});
			await expect(
				command("reset", { NODE_ENV: "production" }),
			).rejects.toMatchObject({ code: 1 });
			await expect(
				command("reset", {
					DATABASE_URL: "libsql://remote.example.com",
				}),
			).rejects.toMatchObject({ code: 1 });
			const untouched = join(directory, "untouched.db");
			await writeFile(untouched, "leave me alone\n");
			await command("reset");
			expect(
				JSON.parse((await command("generate")).stdout),
			).toMatchObject({
				migration: { fileName: "", diff: { up: [] } },
			});
			expect(JSON.parse((await command("check")).stdout)).toMatchObject({
				ok: true,
			});
			expect(JSON.parse((await command("seed")).stdout)).toMatchObject({
				seed: {
					insertedRoleIds: [],
					skippedRoleIds: ["core.participant", "core.owner"],
				},
			});
			expect(await readFile(untouched, "utf8")).toBe("leave me alone\n");
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
}

it("minimal: generates and replays a Core/auth baseline without plugins", async () => {
	const directory = await mkdtemp(join(tmpdir(), "hackkit-minimal-db-"));
	try {
		const input = await loadHackkitConfig("hackkit.config.ts", {
			cwd: templates.minimal.directory,
		});
		expect(input.plugins).toEqual([]);
		expect(input.seedRoles.map((role) => role.id)).toEqual([
			"core.participant",
			"core.owner",
		]);
		const config = {
			...input,
			database: {
				driver: SqliteDriver,
				dbName: join(directory, "web.db"),
				migrations: {
					path: await prepareMigrationDirectory(directory),
					emit: "ts" as const,
					snapshotName: ".snapshot",
					snapshotOnMigrate: false,
				},
			},
			auth: {
				baseURL: templates.minimal.origin,
				secret: "minimal-db-secret-at-least-32-characters",
				emailAndPassword: { enabled: true },
			},
			logger: { disabled: true },
		};
		await runDatabaseCommand(config, {
			command: "generate",
			name: "initial",
		});
		await runDatabaseCommand(config, { command: "migrate" });
		await runDatabaseCommand(config, { command: "seed" });
		expect(
			await runDatabaseCommand(config, { command: "check" }),
		).toMatchObject({ ok: true });
		const core = await initializeHackkit(config);
		try {
			const signup = await core.auth.api.signUpEmail({
				body: {
					name: "Minimal",
					email: "minimal@example.com",
					password: "correct-horse-battery-staple",
				},
			});
			expect(
				await core.createScope().hackkit.users.getUser(signup.user.id),
			).toMatchObject({ email: "minimal@example.com" });
			expect(await core.orm.schema.getUpdateSchemaSQL()).toBe("");
		} finally {
			await core.orm.close();
		}
		// Replaying the application's history initializes another clone without regenerating it.
		const fresh = {
			...config,
			database: {
				...config.database,
				dbName: join(directory, "fresh.db"),
			},
		};
		await runDatabaseCommand(fresh, { command: "migrate" });
		expect(
			await runDatabaseCommand(fresh, { command: "check" }),
		).toMatchObject({ ok: true });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
