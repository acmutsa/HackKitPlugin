import { Cause, Effect } from "effect";
import { operation, originalError, runPromise } from "@hackkit/core/effect";
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import nextEnv from "@next/env";
import { loadHackkitConfig } from "@hackkit/config";

// Match Next's environment loading before evaluating hackkit.config.ts.
nextEnv.loadEnvConfig(
	process.cwd(),
	process.env.NODE_ENV !== "production",
	console,
	true,
);
const jiti = createJiti(fileURLToPath(import.meta.url));
const main = Effect.gen(function* () {
	const { runDatabaseCommand } = yield* operation(() =>
		jiti.import("./database.ts"),
	);
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			config: { type: "string", default: "hackkit.config.ts" },
			output: { type: "string" },
			name: { type: "string" },
			blank: { type: "boolean", default: false },
			to: { type: "string" },
		},
	});
	const [command] = positionals;
	const commands = [
		"generate",
		"status",
		"check",
		"migrate",
		"rollback",
		"reset",
		"seed",
	];
	if (positionals.length !== 1 || !commands.includes(command)) {
		throw new Error(`Choose a database command: ${commands.join(", ")}.`);
	}
	if ((values.name !== undefined || values.blank) && command !== "generate") {
		throw new Error("--name and --blank are only supported by generate.");
	}
	if (values.to !== undefined && !["migrate", "rollback"].includes(command)) {
		throw new Error("--to is only supported by migrate and rollback.");
	}
	if (values.to !== undefined && !values.to.trim()) {
		throw new Error("--to requires a migration name (or 0 for rollback).");
	}
	const config = yield* operation(() => loadHackkitConfig(values.config));
	const result = yield* operation(() =>
		runDatabaseCommand(config, { command, ...values }),
	);
	// Native drivers can write diagnostics to stdout. A separate result file
	// gives release jobs structured output without parsing their logs.
	if (values.output) {
		yield* operation(() =>
			writeFile(values.output, `${JSON.stringify(result, null, 2)}\n`),
		);
	}
	console.log(JSON.stringify(result, null, 2));
	if (result.command === "check" && !result.ok) process.exitCode = 1;
}).pipe(
	Effect.catchAllCause((cause) =>
		Effect.sync(() => {
			const error = originalError(Cause.squash(cause));
			// Print the operation's error without printing the config or connection URL.
			console.error(
				error instanceof Error
					? error.message
					: "Database command failed.",
			);
			process.exitCode = 1;
		}),
	),
);

await runPromise(main);
