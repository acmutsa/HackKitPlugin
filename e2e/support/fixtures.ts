import { test as base, expect } from "@playwright/test";
import { templates } from "./templates.mjs";
import { startTemplate } from "./server.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

type Server = Awaited<ReturnType<typeof startTemplate>>;
export const test = base.extend<{ serverLogs: void }, { app: Server }>({
	extraHTTPHeaders: async ({}, use, testInfo) => {
		// Separate simulated clients retain real production auth rate limiting.
		const digest = createHash("sha256").update(testInfo.testId).digest();
		await use({ "x-forwarded-for": `198.18.${digest[0]}.${digest[1]}` });
	},
	app: [
		async ({}, use, workerInfo) => {
			const template = workerInfo.project.name.startsWith("full-")
				? templates.full
				: templates.minimal;
			const app = await startTemplate(template);
			try {
				await use(app);
			} finally {
				try {
					await mkdir(workerInfo.project.outputDir, {
						recursive: true,
					});
					await writeFile(
						join(
							workerInfo.project.outputDir,
							`server-${workerInfo.workerIndex}.log`,
						),
						app.logs(),
					);
				} finally {
					await app.close();
				}
			}
		},
		{ scope: "worker", timeout: 90000 },
	],
	baseURL: async ({ app }, use) => {
		await use(app.baseURL);
	},
	serverLogs: [
		async ({ app }, use, testInfo) => {
			await use();
			if (testInfo.status !== testInfo.expectedStatus)
				await testInfo.attach("server.log", {
					body: app.logs(),
					contentType: "text/plain",
				});
		},
		{ auto: true },
	],
});
export { expect };
