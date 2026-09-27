import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { MikroORM, defineEntity, p } from "@mikro-orm/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { createOrmOptions, coreModels } from "@hackkit/core";
import type { HackkitConfig } from "@hackkit/config";
import { runDbMigrationGenerate, runDbMigrate } from "../db-migrations";
import { runDbSeed } from "../db-seed";

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

it("generates, applies, and seeds native core, plugin, auth, and app entities", async () => {
	const projectRoot = await mkdtemp(join(process.cwd(), ".migration-test-"));
	directories.push(projectRoot);
	const pluginEntity = defineEntity({
		name: "SampleEntry",
		tableName: "sample_entry",
		properties: { id: p.string().primary(), label: p.string() },
	});
	const appEntity = defineEntity({
		name: "AppNote",
		tableName: "app_note",
		properties: { id: p.string().primary(), body: p.text() },
	});
	const config = {
		database: {
			driver: SqliteDriver,
			dbName: join(projectRoot, "test.db"),
			migrations: { path: join(projectRoot, "migrations"), emit: "ts" },
		},
		auth: { secret: "test-secret-that-is-at-least-32-characters" },
		plugins: [{ id: "sample", entities: [pluginEntity] }],
		entities: [appEntity],
		seedRoles: [
			{
				id: "core.owner",
				name: "Owner",
				position: 0,
				permissions: ["core.superAdmin"],
			},
		],
		logger: { disabled: true },
	} satisfies HackkitConfig;
	const generated = await runDbMigrationGenerate(config, {
		projectRoot,
		name: "initial",
	});
	expect(generated.diff.up.join("\n")).toContain("core_user");
	expect(generated.diff.up.join("\n")).toContain("sample_entry");
	expect(generated.diff.up.join("\n")).toContain("app_note");
	await runDbMigrate(config);
	expect(await runDbMigrate(config)).toHaveLength(0);
	expect((await runDbSeed(config)).insertedRoleIds).toEqual(["core.owner"]);
	expect((await runDbSeed(config)).skippedRoleIds).toEqual(["core.owner"]);
	const orm = await MikroORM.init(createOrmOptions(config));
	try {
		expect(await orm.schema.getUpdateSchemaSQL()).toBe("");
		expect(await orm.em.fork().count(coreModels.role, {})).toBe(1);
		expect(await orm.em.fork().count(pluginEntity, {})).toBe(0);
		expect(await orm.em.fork().count(appEntity, {})).toBe(0);
	} finally {
		await orm.close();
	}
});
