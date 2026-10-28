import { defineConfig } from "@playwright/test";

if (!process.env.DEMO_TEST_URL)
	throw new Error("Set DEMO_TEST_URL to a running demo deployment.");

export default defineConfig({
	testDir: "./tests",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 120_000,
	expect: { timeout: 30_000 },
	reporter: [["list"], ["html", { open: "never" }]],
	webServer: process.env.CI
		? {
				command: "pnpm start > .wrangler/ci-server.log 2>&1",
				url: process.env.DEMO_TEST_URL,
				reuseExistingServer: false,
				timeout: 60_000,
				gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
			}
		: undefined,
	use: {
		baseURL: process.env.DEMO_TEST_URL,
		actionTimeout: 20_000,
		navigationTimeout: 30_000,
		browserName: "chromium",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
});
