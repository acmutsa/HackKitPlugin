import { Effect } from "effect";
import { runPromise, fromResult, boundaryError } from "@hackkit/core/effect";
import { resolve } from "node:path";
import { type HackkitConfig } from "./config";
import { createConfigLogger } from "./logger";
import { withOrm } from "./orm";
export type DbMigrationGenerateOptions = {
	projectRoot: string;
	name?: string;
};
/** Write a migration for review. Applying it is a separate explicit command. */
export function runDbMigrationGenerate(
	config: HackkitConfig,
	options: DbMigrationGenerateOptions,
) {
	return runPromise(
		Effect.gen(function* () {
			const path = config.database.migrations?.path;
			if (!path)
				return yield* Effect.fail(
					boundaryError(
						new Error(
							"Configure database.migrations.path in your app before generating migrations.",
						),
					),
				);
			return yield* fromResult(
				withOrm(config, (orm) =>
					runPromise(
						Effect.gen(function* () {
							const result = yield* fromResult(
								orm.migrator.create(
									resolve(options.projectRoot, path),
									false,
									false,
									options.name,
								),
							);
							createConfigLogger(config).log(
								"info",
								result.fileName
									? `Generated ${result.fileName}. Review its SQL before running hackkit db migrate.`
									: "The database schema has no changes.",
							);
							return result;
						}),
					),
				),
			);
		}),
	);
}
export function runDbMigrate(config: HackkitConfig) {
	return runPromise(
		Effect.suspend(() =>
			fromResult(
				withOrm(config, (orm) =>
					runPromise(
						Effect.gen(function* () {
							const migrations = yield* fromResult(
								orm.migrator.up(),
							);
							createConfigLogger(config).log(
								"info",
								`Applied ${migrations.length} migration(s).`,
							);
							return migrations;
						}),
					),
				),
			),
		),
	);
}
