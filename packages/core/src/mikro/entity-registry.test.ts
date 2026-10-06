import { defineEntity, p } from "@mikro-orm/core";
import { expect, it } from "vitest";
import { createPluginRegistry } from "../plugins.js";

function entity(name: string, tableName: string) {
	return defineEntity({
		name,
		tableName,
		properties: { id: p.string().primary() },
	});
}

it("collects plugin and app entities once alongside Core and auth", () => {
	const pluginEntity = entity("ExampleEntry", "example_entry");
	const appEntity = entity("AppEntry", "app_entry");
	const registry = createPluginRegistry(
		[{ id: "example", entities: [pluginEntity] }],
		[appEntity],
	);
	expect(registry.entities).toContain(pluginEntity);
	expect(registry.entities).toContain(appEntity);
	expect(
		registry.entities.filter((item) => item.meta.tableName === "user"),
	).toHaveLength(0);
	expect(
		registry.entities.filter((item) => item.meta.tableName === "core_user"),
	).toHaveLength(1);
});

it("rejects a plugin attempting to use another namespace", () => {
	expect(() =>
		createPluginRegistry([
			{ id: "example", entities: [entity("Intruder", "core_intruder")] },
		]),
	).toThrow("example_");
});

it("rejects duplicate table or entity names before ORM initialization", () => {
	expect(() =>
		createPluginRegistry([], [entity("DuplicateUser", "core_user")]),
	).toThrow("Duplicate entity name or table");
	expect(() =>
		createPluginRegistry(
			[],
			[entity("Duplicate", "app_one"), entity("Duplicate", "app_two")],
		),
	).toThrow("Duplicate entity name or table");
});
