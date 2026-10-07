#!/usr/bin/env node
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
	.action(async (commandOptions: { config?: string }) => {
		const globalOptions = program.opts<{ config: string }>();
		const config = await loadConfig(
			commandOptions.config ?? globalOptions.config,
		);
		const { runDbSeed } = await import("./db-seed");
		await runDbSeed(config);
	});

db.command("generate")
	.description("Generate an app-owned MikroORM migration for review")
	.option("-c, --config <path>", "path to HackKit config")
	.option("-n, --name <name>", "migration name")
	.action(async (options: { config?: string; name?: string }) => {
		const config = await loadConfig(
			options.config ?? program.opts<{ config: string }>().config,
		);
		const { runDbMigrationGenerate } = await import("./db-migrations");
		await runDbMigrationGenerate(config, {
			projectRoot: process.cwd(),
			name: options.name,
		});
	});

db.command("migrate")
	.description("Apply reviewed MikroORM migrations")
	.option("-c, --config <path>", "path to HackKit config")
	.action(async (options: { config?: string }) => {
		const config = await loadConfig(
			options.config ?? program.opts<{ config: string }>().config,
		);
		const { runDbMigrate } = await import("./db-migrations");
		await runDbMigrate(config);
	});

const plugins = program
	.command("plugin")
	.description("Manage HackKit plugins in this web app");

plugins
	.command("sync")
	.description("Sync plugin routes, actions, and lockfile")
	.option("-c, --config <path>", "path to HackKit config")
	.action(async (commandOptions: { config?: string }) => {
		const globalOptions = program.opts<{ config: string }>();
		const config = await loadConfig(
			commandOptions.config ?? globalOptions.config,
		);
		const { runPluginSyncAll } = await import("./plugin-commands");
		await runPluginSyncAll({
			projectRoot: process.cwd(),
			config,
		});
	});

plugins
	.command("add")
	.description("Add a HackKit plugin to this web app")
	.argument("<plugin>", "plugin id, e.g. teams")
	.option("-c, --config <path>", "path to HackKit config")
	.action(async (pluginId: string, commandOptions: { config?: string }) => {
		const globalOptions = program.opts<{ config: string }>();
		const config = await loadConfig(
			commandOptions.config ?? globalOptions.config,
		);
		const { runPluginAdd } = await import("./plugin-commands");
		await runPluginAdd({ projectRoot: process.cwd(), config }, pluginId);
	});

plugins
	.command("remove")
	.description("Remove a HackKit plugin from this web app")
	.argument("<plugin>", "plugin id, e.g. teams")
	.option("-c, --config <path>", "path to HackKit config")
	.action(async (pluginId: string, commandOptions: { config?: string }) => {
		const globalOptions = program.opts<{ config: string }>();
		const config = await loadConfig(
			commandOptions.config ?? globalOptions.config,
		);
		const { runPluginRemove } = await import("./plugin-commands");
		await runPluginRemove({ projectRoot: process.cwd(), config }, pluginId);
	});

program.parseAsync(process.argv).catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
