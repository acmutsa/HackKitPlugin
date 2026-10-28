import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
	templates,
	e2eDirectory,
	repositoryRoot,
	testEnvironment,
} from "./templates.mjs";
import { runCommand } from "./processes.mjs";

const suite = process.argv[2] ?? "all";
assert.ok(
	["all", "db", "http", "browser"].includes(suite),
	"Choose all, db, http, or browser.",
);
const pnpm = (args, options = {}) =>
	runCommand("corepack", ["pnpm", ...args], {
		cwd: repositoryRoot,
		...options,
	});

async function generatedFiles(template) {
	const entries = [];
	async function collect(directory) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) await collect(path);
			else
				entries.push([
					relative(template.directory, path),
					createHash("sha256")
						.update(await readFile(path))
						.digest("hex"),
				]);
		}
	}
	await collect(join(template.directory, "app"));
	entries.push([
		"hackkit.lock",
		(await readFile(join(template.directory, "hackkit.lock"))).toString(),
	]);
	return entries.sort(([a], [b]) => a.localeCompare(b));
}

await pnpm([
	"exec",
	"turbo",
	"run",
	"build",
	"--filter=@hackkit/template-nextjs-full^...",
	"--filter=@hackkit/template-nextjs-minimal^...",
]);
const buildDirectory = await mkdtemp(join(tmpdir(), "hackkit-build-"));
try {
	const targets = Object.values(templates).map((template) => ({
		template,
		options: {
			cwd: template.directory,
			env: testEnvironment(template, join(buildDirectory, template.id)),
		},
	}));
	for (const { template, options } of targets) {
		const before = await generatedFiles(template);
		await pnpm(["sync"], options);
		assert.deepEqual(
			await generatedFiles(template),
			before,
			`Plugin sync changed ${template.id} generated files. Run its sync command and commit the result.`,
		);
	}
	for (const { options } of targets) await pnpm(["typecheck"], options);
	await pnpm(["typecheck"], { cwd: e2eDirectory });
	await runCommand(process.execPath, ["tooling/check-client-bundle.mjs"], {
		cwd: repositoryRoot,
	});
	if (suite !== "db") {
		for (const { options } of targets) {
			await pnpm(["db:migrate"], options);
			await pnpm(["db:seed"], options);
			await pnpm(["build"], options);
		}
	}
} finally {
	await rm(buildDirectory, { recursive: true, force: true });
}
if (suite === "all" || suite === "db")
	await pnpm(["exec", "vitest", "run"], { cwd: e2eDirectory });
if (suite !== "db") {
	const projects = ["full", "minimal"].flatMap((id) =>
		(suite === "all" ? ["http", "browser"] : [suite]).map(
			(kind) => `--project=${id}-${kind}`,
		),
	);
	await pnpm(["exec", "playwright", "test", ...projects], {
		cwd: e2eDirectory,
	});
}
