import {
	access,
	cp,
	mkdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";
import type { HackkitConfig } from "@hackkit/config";
import {
	createOrmOptions,
	HackKitUser,
	initializeHackkit,
} from "@hackkit/core";
import { MikroORM } from "@mikro-orm/core";
import { expect } from "vitest";
import {
	runDatabaseCommand,
	type DatabaseCommand,
} from "../../scripts/database";
import {
	LegacyNote,
	ExpandedNote,
	FinalNote,
	FlaggedNote,
	PluginEntry,
	PriorityPluginEntry,
	probePlugin,
} from "./migration-fixture-schema";
import { LibSqlDriver } from "@mikro-orm/libsql";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const runProcess = promisify(execFile);

/** Runs on the caller's disposable database after its committed initial migration. */
export async function verifyMigrationUpgrade(
	input: HackkitConfig,
	directory: string,
) {
	// HTTP libSQL's native client can block after repeated ORM destruction in
	// one process. Exercise real CLI lifetimes: one command per Node process.
	async function run(config: HackkitConfig, request: DatabaseCommand) {
		if (
			config.database.driver !== LibSqlDriver ||
			!/^(?:https?|libsql):\/\//.test(config.database.dbName ?? "")
		) {
			return runDatabaseCommand(config, request);
		}
		const exports = { LegacyNote, ExpandedNote, FinalNote, FlaggedNote };
		const noteName = Object.entries(exports).find(([, entity]) =>
			config.entities?.includes(entity),
		)?.[0];
		if (!noteName)
			throw new Error("Upgrade fixture requires a known note entity.");
		const plugin = config.plugins?.find(
			(item) => item.id === "upgradeProbe",
		);
		const priority =
			plugin?.entities?.includes(PriorityPluginEntry) ?? false;
		const fileName =
			request.command === "generate"
				? config.database.migrations?.fileName?.(
						"20990101000000",
						request.name,
					)
				: undefined;
		const configPath = join(directory, "command.config.ts");
		const schemaPath = join(
			process.cwd(),
			"db/__tests__/migration-fixture-schema.ts",
		);
		await symlink(
			join(process.cwd(), "node_modules"),
			join(directory, "node_modules"),
			"dir",
		).catch((error: unknown) => {
			if (
				!(
					error instanceof Error &&
					"code" in error &&
					error.code === "EEXIST"
				)
			)
				throw error;
		});
		await writeFile(
			configPath,
			`
import appConfig from ${JSON.stringify(join(process.cwd(), "hackkit.config.ts"))};
import { LibSqlDriver } from '@mikro-orm/libsql';
import { ${noteName}, probePlugin, PriorityPluginEntry } from ${JSON.stringify(schemaPath)};
export default {
 ...appConfig,
 entities: [${noteName}],
 plugins: [...appConfig.plugins, ${plugin ? `{ ...probePlugin, enabled: ${plugin.enabled !== false}, entities: [${priority ? "PriorityPluginEntry" : "...probePlugin.entities"}] }` : ""}],
 database: {
  driver: LibSqlDriver,
  dbName: ${JSON.stringify(config.database.dbName)},
  password: ${JSON.stringify(config.database.password)},
  migrations: { path: ${JSON.stringify(config.database.migrations?.path)}, snapshot: true, snapshotName: '.snapshot', snapshotOnMigrate: false, silent: true,
   ${fileName ? `fileName: () => ${JSON.stringify(fileName)},` : ""}
  },
 },
};
`,
		);
		const resultPath = join(directory, "command-result.json");
		await rm(resultPath, { force: true });
		const args = [
			"scripts/db.mjs",
			request.command,
			"--config",
			configPath,
			"--output",
			resultPath,
		];
		if (request.command === "generate") {
			if (request.name) args.push("--name", request.name);
			if (request.blank) args.push("--blank");
		}
		if (
			(request.command === "migrate" || request.command === "rollback") &&
			request.to
		)
			args.push("--to", request.to);

		try {
			await runProcess(process.execPath, args, {
				cwd: process.cwd(),
				timeout: 15000,
			});
		} catch (error) {
			if (
				request.command !== "check" ||
				!(
					error instanceof Error &&
					"code" in error &&
					error.code === 1 &&
					"stdout" in error &&
					typeof error.stdout === "string"
				)
			)
				throw error;
		}
		// Test-only boundary: this file comes from our CLI, separately from native driver diagnostics.
		return JSON.parse(await readFile(resultPath, "utf8")) as Awaited<
			ReturnType<typeof runDatabaseCommand>
		>;
	}
	const historyPath = join(directory, "upgrade-history");
	await cp(input.database.migrations!.path!, historyPath, {
		recursive: true,
	});
	let sequence = 0;
	const config = {
		...input,
		plugins: [...(input.plugins ?? []), probePlugin],
		entities: [...(input.entities ?? []), LegacyNote],
		database: {
			...input.database,
			migrations: {
				...input.database.migrations,
				path: historyPath,
				snapshot: true,
				snapshotName: ".snapshot",
				snapshotOnMigrate: false,
				fileName: (_timestamp: string, name?: string) =>
					`Migration209901010000${String(sequence++).padStart(2, "0")}_${name}`,
			},
		},
	};
	const baseline = await run(config, {
		command: "generate",
		name: "application_and_plugin",
	});
	expect(baseline.command).toBe("generate");
	await run(config, { command: "migrate" });
	const orm = await MikroORM.init(createOrmOptions(config));
	try {
		const em = orm.em.fork();
		em.create(HackKitUser, {
			id: "upgrade-user",
			name: "Upgrade User",
			email: "upgrade-user@example.com",
		});
		em.create(LegacyNote, {
			id: "note",
			authId: "upgrade-user",
			legacyText: "Josh’s original data",
		});
		em.create(PluginEntry, { id: "plugin-entry", authId: "upgrade-user" });
		await em.flush();
	} finally {
		await orm.close();
	}

	const expanded = {
		...config,
		entities: [...(input.entities ?? []), ExpandedNote],
	};
	const expansion = await run(expanded, {
		command: "generate",
		name: "expand",
	});
	if (expansion.command !== "generate")
		throw new Error("Expected generation result.");
	const expandName = basename(expansion.migration.fileName, ".ts");
	await run(expanded, { command: "migrate", to: expandName });

	const backfill = await run(expanded, {
		command: "generate",
		name: "backfill",
		blank: true,
	});
	if (backfill.command !== "generate")
		throw new Error("Expected generation result.");
	const backfillName = basename(backfill.migration.fileName, ".ts");
	await writeFile(
		join(historyPath, backfill.migration.fileName),
		`import { Migration } from '@mikro-orm/migrations';
export class ${backfillName} extends Migration {
 override name = '${backfillName}';
 override up(): void { this.addSql('update app_upgrade_note set introduction = legacy_text;'); }
 // This backfill is lossless while the legacy column still exists.
 override down(): void { this.addSql('update app_upgrade_note set introduction = null;'); }
}
`,
	);
	const final = {
		...config,
		entities: [...(input.entities ?? []), FinalNote],
	};
	const contraction = await run(final, {
		command: "generate",
		name: "contract",
	});
	if (contraction.command !== "generate")
		throw new Error("Expected generation result.");
	expect(contraction.destructiveStatements.length).toBeGreaterThan(0);
	const before = await run(final, { command: "status" });
	if (before.command !== "status") throw new Error("Expected status result.");
	expect(before.pending).toHaveLength(2);
	await run(expanded, {
		command: "migrate",
		to: backfillName,
	});
	const staged = await MikroORM.init(createOrmOptions(expanded));
	try {
		const row = await staged.em.fork().findOneOrFail(ExpandedNote, "note");
		expect(row).toMatchObject({
			legacyText: "Josh’s original data",
			introduction: "Josh’s original data",
		});
	} finally {
		await staged.close();
	}
	await run(final, { command: "migrate" });
	const checked = await run(final, { command: "check" });
	expect(checked).toMatchObject({
		command: "check",
		ok: true,
		needsMigration: false,
		pending: [],
		schemaSql: "",
	});
	expect(await run(final, { command: "migrate" })).toMatchObject({
		migrations: [],
	});

	const upgradedPlugin = { ...probePlugin, entities: [PriorityPluginEntry] };
	const flagged = {
		...config,
		plugins: [...(input.plugins ?? []), upgradedPlugin],
		entities: [...(input.entities ?? []), FlaggedNote],
	};
	const ungenerated = await run(flagged, { command: "check" });
	expect(ungenerated).toMatchObject({
		command: "check",
		ok: false,
		needsMigration: true,
	});
	await run(flagged, {
		command: "generate",
		name: "reversible_flag",
	});
	await run(flagged, { command: "migrate" });
	const reverted = await run(flagged, { command: "rollback" });
	if (reverted.command !== "rollback")
		throw new Error("Expected rollback result.");
	expect(reverted.migrations).toHaveLength(1);
	const drift = await run(flagged, { command: "check" });
	expect(drift).toMatchObject({ ok: false, needsMigration: false });
	if (drift.command !== "check") throw new Error("Expected check result.");
	expect(drift.schemaSql).toContain("flag");
	expect(drift.pending).toHaveLength(1);
	await run(flagged, { command: "migrate" });
	expect(await run(flagged, { command: "check" })).toMatchObject({
		ok: true,
	});

	const disabled = {
		...flagged,
		plugins: [
			...(input.plugins ?? []),
			{ ...upgradedPlugin, enabled: false },
		],
	};
	expect(
		await run(disabled, {
			command: "generate",
			name: "disabled",
		}),
	).toMatchObject({ migration: { fileName: "", diff: { up: [] } } });
	const runtime = await initializeHackkit(disabled);
	try {
		const scope = runtime.createScope();
		expect(scope.hackkit.isPluginEnabled("upgradeProbe")).toBe(false);
		expect(() => scope.hackkit.plugins.upgradeProbe).toThrow("is disabled");
		expect(
			await scope.em.findOneOrFail(PriorityPluginEntry, "plugin-entry"),
		).toMatchObject({ authId: "upgrade-user", priority: 0 });
		expect(await scope.em.findOneOrFail(FlaggedNote, "note")).toMatchObject(
			{ authId: "upgrade-user", introduction: "Josh’s original data" },
		);
		expect(
			await scope.em.findOneOrFail(HackKitUser, "upgrade-user"),
		).toMatchObject({ email: "upgrade-user@example.com" });
	} finally {
		await runtime.orm.close();
	}

	// Simulate an intentional uninstall in a separate proposal directory.
	const removalPath = join(directory, "removal-proposal");
	await mkdir(removalPath);
	await cp(historyPath, removalPath, { recursive: true });
	const removal = await run(
		{
			...flagged,
			plugins: input.plugins ?? [],
			database: {
				...flagged.database,
				migrations: {
					...flagged.database.migrations,
					path: removalPath,
				},
			},
		},
		{ command: "generate", name: "uninstall" },
	);
	if (removal.command !== "generate")
		throw new Error("Expected generation result.");
	expect(removal.destructiveStatements.join("\n")).toContain(
		"upgradeProbe_entry",
	);
	// A committed snapshot supports offline generation; it must not create
	// a second database while proposing an unchanged schema.
	const offline = {
		...flagged,
		database: {
			...flagged.database,
			...(flagged.database.clientUrl
				? {
						clientUrl: flagged.database.clientUrl.replace(
							/:\d+\//,
							":1/",
						),
					}
				: { dbName: join(directory, "offline-must-not-exist.db") }),
		},
	};
	expect(
		await run(offline, {
			command: "generate",
			name: "offline",
		}),
	).toMatchObject({ migration: { fileName: "" } });
	if (!flagged.database.clientUrl)
		await expect(access(offline.database.dbName!)).rejects.toMatchObject({
			code: "ENOENT",
		});
	return { config: flagged, historyPath };
}
