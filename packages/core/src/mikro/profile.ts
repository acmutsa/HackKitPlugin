import { defineEntity, p } from "@mikro-orm/core";
import { AuthUser } from "./auth-entities";

export const HackKitProfile = defineEntity({
	name: "HackKitProfile",
	tableName: "core_user",
	properties: {
		user: () => p.oneToOne(AuthUser).owner().primary().deleteRule("cascade"),
		firstName: p.string(),
		lastName: p.string(),
		profilePhotoUrl: p.string().nullable(),
		hackTag: p.string().nullable().unique(),
		bio: p.string().nullable(),
		pronouns: p.string().nullable(),
		skills: p.json<string[]>().default([]),
		isProfileSearchable: p.boolean().default(true),
		discordDisplayHandle: p.string().nullable(),
		isApproved: p.boolean().default(false),
		checkedInAt: p.datetime().nullable(),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
	},
});
