import { spawn } from "node:child_process";

/** Execute commands without a shell, with bounded lifetime and visible diagnostics. */
export async function runCommand(command, args, options = {}) {
	const child = spawn(command, args, {
		cwd: options.cwd,
		env: options.env ?? process.env,
		stdio: "inherit",
		detached: process.platform !== "win32",
	});
	const timer = setTimeout(() => {
		if (process.platform === "win32" || !child.pid) child.kill("SIGKILL");
		else {
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch (error) {
				if (error.code !== "ESRCH") throw error;
			}
		}
	}, options.timeout ?? 300000);
	try {
		await new Promise((resolve, reject) => {
			child.once("error", reject);
			child.once("exit", (code, signal) =>
				code === 0
					? resolve()
					: reject(
							new Error(
								`${command} ${args.join(" ")} failed (${code ?? signal}).`,
							),
						),
			);
		});
	} finally {
		clearTimeout(timer);
	}
}

export async function stopServer(child) {
	if (!child.pid || child.exitCode !== null || child.signalCode !== null)
		return;
	await new Promise((resolve) => {
		const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
		child.once("exit", () => {
			clearTimeout(timer);
			resolve();
		});
		child.kill("SIGTERM");
	});
}
