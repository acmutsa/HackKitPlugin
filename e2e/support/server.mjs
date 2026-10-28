import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { runCommand, stopServer } from "./processes.mjs";
import { testEnvironment } from "./templates.mjs";

async function assertPortAvailable(port) {
	const probe = createServer();
	await new Promise((resolve, reject) => {
		probe.once("error", () =>
			reject(
				new Error(
					`E2E port ${port} is occupied. Stop that process; tests never reuse running apps.`,
				),
			),
		);
		probe.listen(port, "127.0.0.1", () => probe.close(resolve));
	});
}

/** Start the real template build with fresh storage; never inherit developer config. */
export async function startTemplate(template) {
	await assertPortAvailable(template.port);
	const directory = await mkdtemp(
		join(tmpdir(), `hackkit-runtime-${template.id}-`),
	);
	const env = testEnvironment(template, directory);
	let server;
	let output = "";
	try {
		for (const command of ["migrate", "seed"])
			await runCommand(process.execPath, ["scripts/db.mjs", command], {
				cwd: template.directory,
				env,
				timeout: 15000,
			});
		const require = createRequire(join(template.directory, "package.json"));
		server = spawn(
			process.execPath,
			[
				require.resolve("next/dist/bin/next"),
				"start",
				"-H",
				"127.0.0.1",
				"-p",
				String(template.port),
			],
			{ cwd: template.directory, env, stdio: ["ignore", "pipe", "pipe"] },
		);
		server.stdout.on("data", (chunk) => {
			output += chunk.toString();
		});
		server.stderr.on("data", (chunk) => {
			output += chunk.toString();
		});
		server.once("error", (error) => {
			output += error.message;
		});
		let ready = false;
		const deadline = Date.now() + 30000;
		while (Date.now() < deadline) {
			if (
				server.exitCode !== null ||
				server.signalCode !== null ||
				!server.pid
			)
				throw new Error("Next exited before becoming ready.");
			try {
				const response = await fetch(
					`${template.origin}/api/auth/get-session`,
					{ signal: AbortSignal.timeout(1000) },
				);
				ready = response.status === 200;
			} catch {
				/* Retry only while the process is starting. */
			}
			if (ready) break;
			await delay(250);
		}
		if (!ready)
			throw new Error(
				"Next did not become ready within the startup timeout.",
			);
		const child = server;
		return {
			template,
			directory,
			env,
			baseURL: template.origin,
			logs: () => output,
			async close() {
				await stopServer(child);
				await rm(directory, { recursive: true, force: true });
			},
		};
	} catch (error) {
		if (server) await stopServer(server);
		await rm(directory, { recursive: true, force: true });
		throw new Error(
			`Failed starting ${template.id}: ${error instanceof Error ? error.message : String(error)}\n${output}`,
			{ cause: error },
		);
	}
}
