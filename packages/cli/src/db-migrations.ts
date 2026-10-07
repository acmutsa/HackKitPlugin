import { resolve } from "node:path";
import type { HackkitConfig } from "./config";
import { createConfigLogger } from "./logger";
import { withOrm } from "./orm";

export type DbMigrationGenerateOptions = { projectRoot: string; name?: string };

/** Write a migration for review. Applying it is a separate explicit command. */
export async function runDbMigrationGenerate(
	config: HackkitConfig,
	options: DbMigrationGenerateOptions,
) {
	const path = config.database.migrations?.path;
	if (!path)
		throw new Error(
			"Configure database.migrations.path in your app before generating migrations.",
		);
	return withOrm(config, async (orm) => {
		const result = await orm.migrator.create(
			resolve(options.projectRoot, path),
			false,
			false,
			options.name,
		);
		createConfigLogger(config).log(
			"info",
			result.fileName
				? `Generated ${result.fileName}. Review its SQL before running hackkit db migrate.`
				: "The database schema has no changes.",
		);
		return result;
	});
}

export async function runDbMigrate(config: HackkitConfig) {
	return withOrm(config, async (orm) => {
		const migrations = await orm.migrator.up();
		createConfigLogger(config).log(
			"info",
			`Applied ${migrations.length} migration(s).`,
		);
		return migrations;
	});
}
