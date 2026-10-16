/** Compare every existing public value export against a committed revision.
 * Uses TypeScript assignability, including generic calls and inferred API results.
 * Run after building workspace packages so their normal import paths resolve.
 */
import ts from "typescript";
import { execFileSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	readdirSync,
	writeFileSync,
	symlinkSync,
	rmSync,
	existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const revision = process.argv[2] ?? "origin/remove-next-package";
const directory = mkdtempSync(join(tmpdir(), "hackkit-api-"));
try {
	execFileSync("tar", ["-x", "-C", directory], {
		input: execFileSync("git", ["archive", revision], {
			maxBuffer: 32 * 1024 * 1024,
		}),
	});
	symlinkSync(
		join(root, "node_modules"),
		join(directory, "node_modules"),
		"dir",
	);
	const imports = [];
	let count = 0;
	for (const entry of readdirSync(join(directory, "packages"), {
		withFileTypes: true,
	})) {
		if (!entry.isDirectory()) continue;
		const before = join(directory, "packages", entry.name);
		const after = join(root, "packages", entry.name);
		if (existsSync(join(after, "node_modules")))
			symlinkSync(
				join(after, "node_modules"),
				join(before, "node_modules"),
				"dir",
			);
		const manifest = JSON.parse(
			readFileSync(join(before, "package.json"), "utf8"),
		);
		for (const [key, target] of Object.entries(manifest.exports ?? {})) {
			if (typeof target !== "object" || typeof target.types !== "string")
				continue;
			const source = target.types
				.replace(/^\.\/dist\//, "src/")
				.replace(/\.d\.ts$/, ".ts");
			const file = existsSync(join(before, source))
				? source
				: source.replace(/\.ts$/, ".tsx");
			if (!existsSync(join(before, file)))
				throw new Error(
					`Missing source for ${manifest.name}${key}: ${file}`,
				);
			const id = count++;
			imports.push(
				`import * as before${id} from ${JSON.stringify(join(before, file))};`,
			);
			imports.push(
				`import * as after${id} from ${JSON.stringify(join(after, file))};`,
			);
			imports.push(
				`const compatible${id}: typeof before${id} = after${id};`,
			);
		}
	}
	const fixture = join(directory, "compatibility.ts");
	writeFileSync(fixture, imports.join("\n"));
	const compilerOptions = {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		jsx: ts.JsxEmit.ReactJSX,
		strict: true,
		noEmit: true,
		skipLibCheck: true,
		esModuleInterop: true,
		allowImportingTsExtensions: true,
	};
	const host = ts.createCompilerHost(compilerOptions);
	const normalized = new Map();
	const normalize = (path) => {
		if (!normalized.has(path))
			normalized.set(
				path,
				ts
					.createPrinter({ removeComments: true })
					.printFile(
						ts.createSourceFile(
							path,
							readFileSync(path, "utf8"),
							ts.ScriptTarget.Latest,
							true,
							path.endsWith("tsx")
								? ts.ScriptKind.TSX
								: ts.ScriptKind.TS,
						),
					),
			);
		return normalized.get(path);
	};
	host.resolveModuleNames = (names, containingFile) =>
		names.map((name) => {
			const result = ts.resolveModuleName(
				name,
				containingFile,
				compilerOptions,
				host,
			).resolvedModule;
			if (result?.resolvedFileName.startsWith(directory + "/")) {
				const counterpart =
					root + result.resolvedFileName.slice(directory.length);
				// Unchanged declarations share symbols, including conditional generic types.
				if (
					existsSync(counterpart) &&
					normalize(result.resolvedFileName) ===
						normalize(counterpart)
				)
					return { ...result, resolvedFileName: counterpart };
			}
			return result;
		});
	const program = ts.createProgram([fixture], compilerOptions, host);
	const diagnostics = ts.getPreEmitDiagnostics(program);
	if (diagnostics.length) {
		process.stderr.write(
			ts.formatDiagnosticsWithColorAndContext(diagnostics, {
				getCanonicalFileName: (name) => name,
				getCurrentDirectory: () => root,
				getNewLine: () => "\n",
			}),
		);
		process.exitCode = 1;
	} else
		console.log(
			`Public APIs remain assignable to ${revision} across ${count} existing package entrypoints.`,
		);
} finally {
	rmSync(directory, { recursive: true, force: true });
}
