import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { loadHackkitConfig } from "@hackkit/config";
import { config as loadEnv } from "dotenv";
import { join } from "node:path";

export function loadConfig(configFile: string, options: { cwd?: string } = {}) {
	return runPromise(
		Effect.gen(function* () {
			const cwd = options.cwd ?? process.cwd();
			const nodeEnv = process.env.NODE_ENV ?? "development";
			const localFiles =
				nodeEnv === "test"
					? []
					: [`.env.${nodeEnv}.local`, ".env.local"];
			loadEnv({
				path: [
					...localFiles.map((file) => join(cwd, file)),
					join(cwd, `.env.${nodeEnv}`),
					join(cwd, ".env"),
				],
				override: false,
			});
			return yield* fromResult(loadHackkitConfig(configFile, { cwd }));
		}),
	);
}
