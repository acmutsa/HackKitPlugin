import { HackKitUser } from "@hackkit/core";
import { defineEntity, p } from "@mikro-orm/core";

// A small application upgrade. Historical migrations use frozen SQL, never
// import these current entities, and run through the actual app script API.
const noteFields = {
	id: p.string().primary(),
	authId: () => p.manyToOne(HackKitUser).mapToPk().deleteRule("cascade"),
};
export const LegacyNote = defineEntity({
	name: "UpgradeNote",
	tableName: "app_upgrade_note",
	properties: {
		id: p.string().primary(),
		authId: () => p.manyToOne(HackKitUser).mapToPk().deleteRule("cascade"),
		legacyText: p.string(),
	},
});
export const ExpandedNote = defineEntity({
	name: "UpgradeNote",
	tableName: "app_upgrade_note",
	properties: {
		...noteFields,
		legacyText: p.string(),
		introduction: p.string().nullable(),
	},
});
export const FinalNote = defineEntity({
	name: "UpgradeNote",
	tableName: "app_upgrade_note",
	properties: {
		id: p.string().primary(),
		authId: () => p.manyToOne(HackKitUser).mapToPk().deleteRule("cascade"),
		introduction: p.string(),
	},
});
export const FlaggedNote = defineEntity({
	name: "UpgradeNote",
	tableName: "app_upgrade_note",
	properties: {
		...noteFields,
		introduction: p.string(),
		flag: p.string().nullable(),
	},
});
export const PluginEntry = defineEntity({
	name: "UpgradePluginEntry",
	tableName: "upgradeProbe_entry",
	properties: {
		id: p.string().primary(),
		authId: () => p.manyToOne(HackKitUser).mapToPk().deleteRule("cascade"),
	},
});
export const PriorityPluginEntry = defineEntity({
	name: "UpgradePluginEntry",
	tableName: "upgradeProbe_entry",
	properties: { ...noteFields, priority: p.integer().default(0) },
});
export const probePlugin = {
	id: "upgradeProbe",
	entities: [PluginEntry],
	setup: () => ({ active: () => true }),
};
