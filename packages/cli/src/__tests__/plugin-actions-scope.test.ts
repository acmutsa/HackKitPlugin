import ts from "typescript";
import { expect, it, vi } from "vitest";
import { renderPluginActionsFile } from "../plugin-sync";

it("resolves each generated action's actor when called, without capturing a module-level request", async () => {
	const source = await renderPluginActionsFile([
		{
			id: "example",
			packageName: "@example/plugin",
			actionFactory: "createExampleActions",
			actionNames: ["submit"],
		},
	]);
	const getRuntime = vi
		.fn()
		.mockResolvedValueOnce({ actor: "first" })
		.mockResolvedValueOnce({ actor: "second" });
	const imports: Record<string, object> = {
		"@/lib/runtime": { getRuntime },
		"@example/plugin/actions": {
			createExampleActions: (runtime: { actor: string }) => ({
				submit: async () => runtime.actor,
			}),
		},
	};
	const output = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS },
	}).outputText;
	const actions: Record<string, () => Promise<unknown>> = {};
	new Function("require", "exports", output)(
		(name: string) => imports[name],
		actions,
	);
	expect(getRuntime).not.toHaveBeenCalled();
	expect(await actions.submit()).toBe("first");
	expect(await actions.submit()).toBe("second");
	expect(getRuntime).toHaveBeenCalledTimes(2);
});
