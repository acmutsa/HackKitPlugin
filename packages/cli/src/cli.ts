#!/usr/bin/env node
import { Effect } from "effect";
import {
	runPromise,
	fromResult,
	operation,
	originalError,
} from "@hackkit/core/effect";
import { Command } from "commander";
import { loadConfig } from "./cli-config";
const program = new Command()
	.name("hackkit")
	.description("Manage HackKit projects")
	.option(
		"-c, --config <path>",
		"path to HackKit config",
		"hackkit.config.ts",
	);
const db = program
	.command("db")
	.description("Manage HackKit database resources");
db.command("seed")
	.description("Add configured seed roles to the database")
	.option("-c, --config <path>", "path to HackKit config")
	.action((commandOptions: { config?: string }) =>
		runPromise(
			Effect.gen(function* () {
				const globalOptions = program.opts<{
					config: string;
				}>();
				const config = yield* fromResult(
					loadConfig(commandOptions.config ?? globalOptions.config),
				);
				const { runDbSeed } = yield* fromResult(import("./db-seed"));
				yield* fromResult(runDbSeed(config));
			}),
		),
	);
db.command("generate")
	.description("Generate an app-owned MikroORM migration for review")
	.option("-c, --config <path>", "path to HackKit config")
	.option("-n, --name <name>", "migration name")
	.action((options: { config?: string; name?: string }) =>
		runPromise(
			Effect.gen(function* () {
				const config = yield* fromResult(
					loadConfig(
						options.config ??
							program.opts<{
								config: string;
							}>().config,
					),
				);
				const { runDbMigrationGenerate } = yield* fromResult(
					import("./db-migrations"),
				);
				yield* fromResult(
					runDbMigrationGenerate(config, {
						projectRoot: process.cwd(),
						name: options.name,
					}),
				);
			}),
		),
	);
db.command("migrate")
	.description("Apply reviewed MikroORM migrations")
	.option("-c, --config <path>", "path to HackKit config")
	.action((options: { config?: string }) =>
		runPromise(
			Effect.gen(function* () {
				const config = yield* fromResult(
					loadConfig(
						options.config ??
							program.opts<{
								config: string;
							}>().config,
					),
				);
				const { runDbMigrate } = yield* fromResult(
					import("./db-migrations"),
				);
				yield* fromResult(runDbMigrate(config));
			}),
		),
	);
const plugins = program
	.command("plugin")
	.description("Manage HackKit plugins in this web app");
plugins
	.command("sync")
	.description("Sync plugin routes and lockfile")
	.option("-c, --config <path>", "path to HackKit config")
	.action((commandOptions: { config?: string }) =>
		runPromise(
			Effect.gen(function* () {
				const globalOptions = program.opts<{
					config: string;
				}>();
				const config = yield* fromResult(
					loadConfig(commandOptions.config ?? globalOptions.config),
				);
				const { runPluginSyncAll } = yield* fromResult(
					import("./plugin-commands"),
				);
				yield* fromResult(
					runPluginSyncAll({
						projectRoot: process.cwd(),
						config,
					}),
				);
			}),
		),
	);
plugins
	.command("add")
	.description("Add a HackKit plugin to this web app")
	.argument("<plugin>", "plugin id, e.g. teams")
	.option("-c, --config <path>", "path to HackKit config")
	.action(
		(
			pluginId: string,
			commandOptions: {
				config?: string;
			},
		) =>
			runPromise(
				Effect.gen(function* () {
					const globalOptions = program.opts<{
						config: string;
					}>();
					const config = yield* fromResult(
						loadConfig(
							commandOptions.config ?? globalOptions.config,
						),
					);
					const { runPluginAdd } = yield* fromResult(
						import("./plugin-commands"),
					);
					yield* fromResult(
						runPluginAdd(
							{ projectRoot: process.cwd(), config },
							pluginId,
						),
					);
				}),
			),
	);
plugins
	.command("remove")
	.description("Remove a HackKit plugin from this web app")
	.argument("<plugin>", "plugin id, e.g. teams")
	.option("-c, --config <path>", "path to HackKit config")
	.action(
		(
			pluginId: string,
			commandOptions: {
				config?: string;
			},
		) =>
			runPromise(
				Effect.gen(function* () {
					const globalOptions = program.opts<{
						config: string;
					}>();
					const config = yield* fromResult(
						loadConfig(
							commandOptions.config ?? globalOptions.config,
						),
					);
					const { runPluginRemove } = yield* fromResult(
						import("./plugin-commands"),
					);
					yield* fromResult(
						runPluginRemove(
							{ projectRoot: process.cwd(), config },
							pluginId,
						),
					);
				}),
			),
	);
void runPromise(
	operation(() => program.parseAsync(process.argv)).pipe(
		Effect.catchAll((error) =>
			Effect.sync(() => {
				console.error(originalError(error));
				process.exitCode = 1;
			}),
		),
	),
);
