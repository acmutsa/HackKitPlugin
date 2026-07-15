import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineModel, field, type DatabaseAdapterFactory } from "@hackkit/core";
import { describe, expect, it } from "vitest";
import { runDbSchemaGenerate } from "../db-schema";

function createConfig(database: DatabaseAdapterFactory) {
	const entry = defineModel("sample.entry", {
		fields: { id: field.string().primaryKey() },
	});
	return {
		database,
		plugins: [{ id: "sample", models: { entry } }],
		seedRoles: [],
	};
}

describe("hackkit db schema generate", () => {
	it("writes the adapter schema to the default app-owned path", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "hackkit-schema-"));
		const database: DatabaseAdapterFactory = {
			create: () => ({}) as never,
			schema: {
				id: "test-schema",
				generateSchemaFiles: () => [
					{
						path: "hackkit.ts",
						content: "export const generated = true;\n",
					},
				],
			},
		};

		const result = await runDbSchemaGenerate(createConfig(database), {
			projectRoot,
		});

		expect(result.outputPath).toBe(
			join(projectRoot, "db/schema/hackkit.ts"),
		);
		await expect(readFile(result.outputPath, "utf8")).resolves.toBe(
			"export const generated = true;\n",
		);
	});

	it("supports an explicit output path", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "hackkit-schema-"));
		const database: DatabaseAdapterFactory = {
			create: () => ({}) as never,
			schema: {
				id: "test-schema",
				generateSchemaFiles: () => [
					{ path: "hackkit.ts", content: "// schema\n" },
				],
			},
		};

		const result = await runDbSchemaGenerate(createConfig(database), {
			projectRoot,
			output: "custom/generated.ts",
		});

		expect(result.outputPath).toBe(
			join(projectRoot, "custom/generated.ts"),
		);
		await expect(readFile(result.outputPath, "utf8")).resolves.toBe(
			"// schema\n",
		);
	});

	it("fails when the configured database cannot generate schema", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "hackkit-schema-"));
		const database: DatabaseAdapterFactory = {
			create: () => ({}) as never,
		};

		await expect(
			runDbSchemaGenerate(createConfig(database), { projectRoot }),
		).rejects.toThrow(
			"Configured database adapter does not support native schema generation.",
		);
	});
});
