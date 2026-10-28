import { defineConfig, devices } from "@playwright/test";
import { e2eDirectory } from "./support/templates.mjs";

export default defineConfig({
	testDir: e2eDirectory,
	testMatch: ["http/**/*.spec.ts", "browser/**/*.spec.ts"],
	outputDir: "test-results",
	workers: 1,
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	timeout: 60000,
	expect: { timeout: 10000 },
	reporter: [
		["list"],
		["html", { open: "never" }],
		["junit", { outputFile: "test-results/results.xml" }],
	],
	use: {
		...devices["Desktop Chrome"],
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: ["full", "minimal"].flatMap((template) =>
		["http", "browser"].map((kind) => ({
			name: `${template}-${kind}`,
			testMatch: `${kind}/**/*.spec.ts`,
		})),
	),
});
