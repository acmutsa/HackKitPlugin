import { defineConfig } from "vitest/config";
import {
	e2eDirectory,
	templates,
	testEnvironment,
} from "./support/templates.mjs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export default defineConfig({
	test: {
		root: e2eDirectory,
		include: ["database/**/*.test.ts"],
		setupFiles: ["./support/database-env.ts"],
		fileParallelism: false,
		testTimeout: 120000,
		hookTimeout: 30000,
		env: {
			...testEnvironment(
				templates.full,
				join(tmpdir(), "hackkit-unused-config"),
			),
			NODE_ENV: "test",
		},
	},
});
