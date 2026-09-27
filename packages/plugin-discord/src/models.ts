import {
	defineEntity,
	p,
	type EntityDTO,
	type InferEntity,
} from "@mikro-orm/core";
import { HackKitProfile } from "@hackkit/core";

export const DiscordVerification = defineEntity({
	name: "DiscordVerification",
	tableName: "discord_verification",
	properties: {
		code: p.string().primary(),
		discordUserId: p.string(),
		guildId: p.string(),
		username: p.string(),
		avatarHash: p.string().nullable(),
		authId: () =>
			p
				.manyToOne(HackKitProfile)
				.mapToPk()
				.fieldName("auth_id")
				.nullable()
				.deleteRule("set null"),
		status: p
			.enum(["pending", "accepted", "rejected", "expired"] as const)
			.default("pending"),
		expiresAt: p.datetime(),
		createdAt: p.datetime().onCreate(() => new Date()),
		acceptedAt: p.datetime().nullable(),
	},
	indexes: [
		{ properties: ["discordUserId"] },
		{ properties: ["guildId"] },
		{ properties: ["authId"] },
		{ properties: ["status"] },
		{ properties: ["createdAt"] },
	],
});

export const DiscordMember = defineEntity({
	name: "DiscordMember",
	tableName: "discord_member",
	properties: {
		authId: () =>
			p
				.manyToOne(HackKitProfile)
				.mapToPk()
				.fieldName("auth_id")
				.primary()
				.deleteRule("cascade"),
		discordUserId: p.string().unique(),
		guildId: p.string(),
		username: p.string(),
		avatarHash: p.string().nullable(),
		verifiedAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
		lastRoleSyncAt: p.datetime().nullable(),
	},
	indexes: [
		{ properties: ["discordUserId"] },
		{ properties: ["guildId"] },
		{ properties: ["updatedAt"] },
	],
});

export const DiscordRoleSyncAttempt = defineEntity({
	name: "DiscordRoleSyncAttempt",
	tableName: "discord_role_sync_attempt",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		authId: () =>
			p
				.manyToOne(HackKitProfile)
				.mapToPk()
				.fieldName("auth_id")
				.deleteRule("cascade"),
		discordUserId: p.string(),
		guildId: p.string(),
		status: p.enum(["synced", "failed", "skipped"] as const),
		roleIds: p.json<string[]>().default([]),
		roleNames: p.json<string[]>().default([]),
		error: p.text().nullable(),
		createdAt: p.datetime().onCreate(() => new Date()),
	},
	indexes: [
		{ properties: ["authId"] },
		{ properties: ["discordUserId"] },
		{ properties: ["status"] },
		{ properties: ["createdAt"] },
	],
});

export const discordModels = {
	verification: DiscordVerification,
	member: DiscordMember,
	roleSyncAttempt: DiscordRoleSyncAttempt,
} as const;
export type DiscordVerification = EntityDTO<
	InferEntity<typeof DiscordVerification>
>;
export type DiscordMember = EntityDTO<InferEntity<typeof DiscordMember>>;
export type DiscordRoleSyncAttempt = EntityDTO<
	InferEntity<typeof DiscordRoleSyncAttempt>
>;
