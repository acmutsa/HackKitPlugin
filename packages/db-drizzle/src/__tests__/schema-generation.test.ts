import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineModel, field, type StorageRegistry } from "@hackkit/core";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createDrizzlePostgresSchemaAdapter } from "../postgres";
import {
	createDrizzleSqliteAdapter,
	createDrizzleSqliteSchemaAdapter,
} from "../sqlite";

function createStorage(): StorageRegistry {
	const user = defineModel("core.user", {
		fields: {
			id: field.string().primaryKey().defaultId(),
			active: field.boolean().default(true),
			createdAt: field.date().defaultNow(),
			profile: field.json<{ nickname: string }>().optional(),
		},
	});
	const entry = defineModel("sample.entry", {
		fields: {
			id: field.string().primaryKey().defaultId(),
			userId: field
				.string()
				.references("core.user", "id", { onDelete: "cascade" }),
			score: field.number(),
			status: field
				.enum(["draft", "published"] as const)
				.default("draft"),
		},
		unique: [["userId", "status"]],
		indexes: [["score"]],
	});

	return { models: { user, entry } };
}

async function expectGeneratedSchemaToCompile(source: string): Promise<void> {
	const directory = await mkdtemp(join(process.cwd(), ".schema-compile-"));
	const filePath = join(directory, "hackkit.ts");
	try {
		await writeFile(filePath, source, "utf8");
		const program = ts.createProgram([filePath], {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			noEmit: true,
			skipLibCheck: true,
			strict: true,
		});
		const diagnostics = ts.getPreEmitDiagnostics(program);
		expect(
			diagnostics.map((diagnostic) =>
				ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
			),
		).toEqual([]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

describe("Drizzle native schema generation", () => {
	it("generates deterministic SQLite schema source", async () => {
		const [file] =
			await createDrizzleSqliteSchemaAdapter().generateSchemaFiles({
				storage: createStorage(),
			});

		expect(file.path).toBe("hackkit.ts");
		expect(file.content).toContain(
			'import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";',
		);
		expect(file.content).toContain(
			'export const coreUser = sqliteTable("core_user"',
		);
		expect(file.content).toContain(
			'references(() => coreUser.id, { onDelete: "cascade" })',
		);
		expect(file.content).toContain(
			'integer("active", { mode: "boolean" }).notNull().default(true)',
		);
		expect(file.content).toContain(
			'sample_entry_userId_status_uniq: uniqueIndex("sample_entry_userId_status_uniq")',
		);
		await expectGeneratedSchemaToCompile(file.content);
	});

	it("generates PostgreSQL schema with native PostgreSQL types", async () => {
		const [file] =
			await createDrizzlePostgresSchemaAdapter().generateSchemaFiles({
				storage: createStorage(),
			});

		expect(file.path).toBe("hackkit.ts");
		expect(file.content).toContain('from "drizzle-orm/pg-core"');
		expect(file.content).toContain(
			'export const coreUser = pgTable("core_user"',
		);
		expect(file.content).toContain(
			'active: boolean("active").notNull().default(true)',
		);
		expect(file.content).toContain(
			'createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull()',
		);
		expect(file.content).toContain('profile: jsonb("profile")');
		expect(file.content).toContain(
			'score: doublePrecision("score").notNull()',
		);
		await expectGeneratedSchemaToCompile(file.content);
	});

	it("rejects model keys that resolve to the same physical table", () => {
		const first = defineModel("sample.entry.item", {
			fields: { id: field.string().primaryKey() },
		});
		const second = defineModel("sample_entry.item", {
			fields: { id: field.string().primaryKey() },
		});
		const storage = { models: { first, second } };

		expect(() =>
			createDrizzleSqliteSchemaAdapter().generateSchemaFiles({ storage }),
		).toThrow("resolve to the same table 'sample_entry_item'");
	});

	it("removes plugin tables when they leave the storage registry", async () => {
		const storage = createStorage();
		const withoutPlugin = {
			models: { user: storage.models.user },
		};
		const [file] =
			await createDrizzleSqliteSchemaAdapter().generateSchemaFiles({
				storage: withoutPlugin,
			});

		expect(file.content).toContain("export const coreUser");
		expect(file.content).not.toContain("export const sampleEntry");
	});

	it("does not resolve the runtime database while generating schema", async () => {
		let resolutions = 0;
		const adapter = createDrizzleSqliteAdapter(() => {
			resolutions += 1;
			return {};
		});

		await adapter.schema!.generateSchemaFiles({ storage: createStorage() });

		expect(resolutions).toBe(0);
	});
});
