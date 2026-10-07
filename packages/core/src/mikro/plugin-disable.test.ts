import { defineEntity, p } from "@mikro-orm/core";
import { expect, it } from "vitest";
import { createTestHackkit } from "../testing";

it("retains disabled plugin schema and data without activating its API", async () => {
	const Entry = defineEntity({
		name: "DisabledEntry",
		tableName: "example_entry",
		properties: { id: p.string().primary(), value: p.string() },
	});
	let setups = 0;
	const hackkit = await createTestHackkit({
		plugins: [
			{
				id: "example",
				enabled: false,
				entities: [Entry],
				permissions: { Read: "example.read" },
				setup: () => {
					setups++;
					return { read: () => "should not run" };
				},
			},
		],
	});
	hackkit.em.create(Entry, { id: "retained", value: "existing data" });
	await hackkit.em.flush();
	expect(setups).toBe(0);
	expect(hackkit.isPluginEnabled("example")).toBe(false);
	expect(hackkit.isPluginEnabled("missing")).toBe(false);
	expect(hackkit.registry.permissions["example.Read"]).toBe("example.read");
	expect(() => hackkit.plugins.example.read()).toThrow(
		"plugin 'example' is disabled",
	);
	expect((await hackkit.em.findOneOrFail(Entry, "retained")).value).toBe(
		"existing data",
	);
	expect(await hackkit.runtime.orm.schema.getUpdateSchemaSQL()).toBe("");
});
