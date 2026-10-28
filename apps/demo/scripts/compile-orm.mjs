import { spawnSync } from "node:child_process";
// Compiling entity functions never needs credentials or a database connection.
const result = spawnSync(
	process.execPath,
	[
		"node_modules/@mikro-orm/cli/cli.js",
		"compile",
		"--config",
		"scripts/orm.config.mjs",
		"--out",
		"lib/generated/orm-functions.js",
	],
	{
		stdio: "inherit",
		env: {
			...process.env,
			TURSO_DATABASE_URL: "http://127.0.0.1:9",
			TURSO_AUTH_TOKEN: "metadata-only",
			BETTER_AUTH_SECRET: "build-only-secret-no-network-or-runtime-use",
		},
	},
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
