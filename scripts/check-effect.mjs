/** Check that production workflows use Effect rather than Promise control flow. */
import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
function* files(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (
			[
				"node_modules",
				"dist",
				".next",
				"db",
				"__tests__",
				"_hackkit",
			].includes(entry.name)
		)
			continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (
			/\.(ts|tsx|mjs)$/.test(path) &&
			!/\.(test|d)\.ts$/.test(path) &&
			!entry.name.startsWith("test-") &&
			entry.name !== "testing.ts"
		)
			yield path;
	}
}
const violations = [];
let checked = 0;
for (const path of [
	...files(join(root, "packages")),
	...files(join(root, "apps/web")),
]) {
	checked++;
	const source = readFileSync(path, "utf8");
	const file = ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
	const report = (node, message) =>
		violations.push(
			`${relative(root, path)}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}: ${message}`,
		);
	function visit(node) {
		if (
			ts.isFunctionLike(node) &&
			node.body &&
			node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
		)
			report(
				node,
				"Use an Effect program and a Promise adapter at the boundary.",
			);
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression)
		) {
			const expression = node.expression;
			if (
				ts.isIdentifier(expression.expression) &&
				expression.expression.text === "Promise" &&
				["all", "allSettled", "race", "any"].includes(
					expression.name.text,
				)
			)
				report(node, "Compose concurrency with Effect.");
			if (
				["catch", "then"].includes(expression.name.text) &&
				!path.endsWith("/core/src/effect.ts")
			)
				report(node, "Compose recovery and continuations with Effect.");
		}
		if (
			ts.isNewExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "Promise"
		)
			report(
				node,
				"Use Effect.async for callback APIs and register cleanup.",
			);
		ts.forEachChild(node, visit);
	}
	visit(file);
}
for (const name of [
	"core",
	"next",
	"ui",
	"config",
	"cli",
	"blob-local",
	"blob-s3",
	"plugin-teams",
	"plugin-discord",
	"plugin-notifications-email",
]) {
	const manifest = JSON.parse(
		readFileSync(join(root, "packages", name, "package.json"), "utf8"),
	);
	if (!manifest.dependencies?.effect)
		violations.push(`${manifest.name} must declare its Effect dependency.`);
}
if (violations.length) {
	process.stderr.write(violations.join("\n") + "\n");
	process.exitCode = 1;
} else
	console.log(
		`Effect workflow checks passed for ${checked} production files.`,
	);
