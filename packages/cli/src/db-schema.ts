import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createPluginRegistry } from "@hackkit/core";
import type { HackkitConfig } from "./config";
import { createConfigLogger } from "./logger";

export type DbSchemaGenerateOptions = {
	projectRoot: string;
	output?: string;
};

export type DbSchemaGenerateResult = {
	outputPath: string;
	adapterId: string;
};

export async function runDbSchemaGenerate(
	config: HackkitConfig,
	options: DbSchemaGenerateOptions,
): Promise<DbSchemaGenerateResult> {
	const schemaAdapter = config.database.schema;
	if (!schemaAdapter) {
		throw new Error(
			"Configured database adapter does not support native schema generation.",
		);
	}

	const registry = createPluginRegistry(config.plugins ?? []);
	const generatedFiles = await schemaAdapter.generateSchemaFiles({
		storage: registry.storage,
	});
	if (generatedFiles.length !== 1) {
		throw new Error(
			`Database schema adapter '${schemaAdapter.id}' must generate exactly one schema file.`,
		);
	}

	const [generatedFile] = generatedFiles;
	const outputPath = resolve(
		options.projectRoot,
		options.output ?? `db/schema/${generatedFile.path}`,
	);
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, generatedFile.content, "utf8");

	createConfigLogger(config).log(
		"info",
		`Generated HackKit schema at ${outputPath}.`,
	);
	return { outputPath, adapterId: schemaAdapter.id };
}
