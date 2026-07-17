import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../cli-config";

const testEnvKey = "HACKKIT_CLI_ENV_FILE_TEST";
const originalValue = process.env[testEnvKey];

afterEach(() => {
	if (originalValue === undefined) {
		delete process.env[testEnvKey];
	} else {
		process.env[testEnvKey] = originalValue;
	}
});

describe("CLI config loading", () => {
	it("loads app environment files before evaluating hackkit.config.ts", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "hackkit-config-"));
		await writeFile(
			join(projectRoot, ".env"),
			`${testEnvKey}=from-app-env\n`,
		);
		await writeFile(
			join(projectRoot, "hackkit.config.ts"),
			`export default {
				database: { create() { throw new Error("unused"); } },
				loadedEnvValue: process.env.${testEnvKey},
			};`,
		);
		delete process.env[testEnvKey];

		const config = await loadConfig("hackkit.config.ts", {
			cwd: projectRoot,
		});

		expect(
			(config as typeof config & { loadedEnvValue?: string }).loadedEnvValue,
		).toBe("from-app-env");
	});
});
