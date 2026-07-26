import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HackkitConfig } from "@hackkit/config";
import type { HackKitPlugin } from "@hackkit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	loadConfig: vi.fn(),
	syncPlugins: vi.fn().mockResolvedValue({
		routesWritten: 0,
		stubsRemoved: 0,
	}),
}));

vi.mock("../cli-config", () => ({ loadConfig: mocks.loadConfig }));
vi.mock("../plugin-sync", () => ({ runPluginSync: mocks.syncPlugins }));

import {
	runPluginAdd,
	runPluginRemove,
	runPluginSyncAll,
} from "../plugin-commands";

const teamsPlugin: HackKitPlugin = {
	id: "teams",
	packageName: "@hackkit/plugin-teams",
};
const directories: string[] = [];

async function createProject(
	configSource: string,
	dependencies: Record<string, string>,
) {
	const projectRoot = await mkdtemp(join(process.cwd(), ".plugin-command-"));
	directories.push(projectRoot);
	await writeFile(
		join(projectRoot, "package.json"),
		`${JSON.stringify({ dependencies }, null, 2)}\n`,
		"utf8",
	);
	await writeFile(
		join(projectRoot, "hackkit.config.ts"),
		configSource,
		"utf8",
	);
	return projectRoot;
}

beforeEach(() => vi.clearAllMocks());
afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) =>
				rm(directory, { recursive: true, force: true }),
			),
	);
});

describe("plugin route orchestration", () => {
	it("syncs routes after plugin add without generating a separate database schema", async () => {
		const projectRoot = await createProject(
			"export default { plugins: [] };\n",
			{
				"@hackkit/plugin-teams": "workspace:*",
			},
		);
		const refreshedConfig: HackkitConfig = { plugins: [teamsPlugin] };
		mocks.loadConfig.mockResolvedValue(refreshedConfig);

		await runPluginAdd({ projectRoot, config: { plugins: [] } }, "teams");

		expect(mocks.syncPlugins).toHaveBeenCalledOnce();
		const configSource = await readFile(
			join(projectRoot, "hackkit.config.ts"),
			"utf8",
		);
		expect(configSource).toContain("teamsPlugin()");
		expect(configSource).toContain('from "@hackkit/plugin-teams"');
	});

	it("syncs routes after plugin removal", async () => {
		const projectRoot = await createProject(
			'import { teamsPlugin } from "@hackkit/plugin-teams";\nexport default { plugins: [teamsPlugin()] };\n',
			{ "@hackkit/plugin-teams": "workspace:*" },
		);
		await runPluginRemove(
			{ projectRoot, config: { plugins: [teamsPlugin] } },
			"teams",
		);

		expect(mocks.syncPlugins).toHaveBeenCalledOnce();
		const configSource = await readFile(
			join(projectRoot, "hackkit.config.ts"),
			"utf8",
		);
		expect(configSource).not.toContain("teamsPlugin");
		expect(configSource).not.toContain("@hackkit/plugin-teams");
	});

	it("only syncs routes and lockfile", async () => {
		await runPluginSyncAll({
			projectRoot: process.cwd(),
			config: { plugins: [teamsPlugin] },
		});
		expect(mocks.syncPlugins).toHaveBeenCalledOnce();
	});
});
