import { chmodSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const args of [
	["scripts/compile-orm.mjs"],
	["node_modules/vite/bin/vite.js", "build"],
]) {
	const result = spawnSync(process.execPath, args, { stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

// Cloudflare copies local variables into the preview output. Keep that ignored
// file private. Turbo excludes credential files and never caches this build.
if (existsSync("dist/server")) {
	for (const file of readdirSync("dist/server")) {
		if (/^\.(dev\.vars|env)(\.|$)/.test(file))
			chmodSync(`dist/server/${file}`, 0o600);
	}
}
