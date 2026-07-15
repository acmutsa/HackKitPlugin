import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const coreRole = sqliteTable("core_role", {
	id: text("id").primaryKey().notNull(),
	name: text("name").notNull().unique(),
	position: integer("position").notNull(),
	permissions: text("permissions", { mode: "json" }).notNull().default([]),
	color: text("color"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	core_role_position_idx: index("core_role_position_idx").on(table.position)
}));

export const coreUser = sqliteTable("core_user", {
	authId: text("authId").primaryKey().notNull(),
	email: text("email").notNull().unique(),
	firstName: text("firstName").notNull(),
	lastName: text("lastName").notNull(),
	profilePhotoUrl: text("profilePhotoUrl"),
	hackTag: text("hackTag").unique(),
	bio: text("bio"),
	pronouns: text("pronouns"),
	skills: text("skills", { mode: "json" }).notNull().default([]),
	isProfileSearchable: integer("isProfileSearchable", { mode: "boolean" }).notNull().default(true),
	discordDisplayHandle: text("discordDisplayHandle"),
	roleId: text("roleId").references(() => coreRole.id, { onDelete: "set null" }),
	isApproved: integer("isApproved", { mode: "boolean" }).notNull().default(false),
	checkedInAt: integer("checkedInAt", { mode: "timestamp" }),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	core_user_email_idx: index("core_user_email_idx").on(table.email),
	core_user_hackTag_idx: index("core_user_hackTag_idx").on(table.hackTag),
	core_user_roleId_idx: index("core_user_roleId_idx").on(table.roleId),
	core_user_createdAt_idx: index("core_user_createdAt_idx").on(table.createdAt)
}));

export const coreUserData = sqliteTable("core_userData", {
	authId: text("authId").primaryKey().notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	age: integer("age").notNull(),
	gender: text("gender").notNull(),
	race: text("race").notNull(),
	ethnicity: text("ethnicity").notNull(),
	shirtSize: text("shirtSize").notNull(),
	dietaryRestrictions: text("dietaryRestrictions", { mode: "json" }).notNull().default([]),
	accommodationNote: text("accommodationNote"),
	phoneNumber: text("phoneNumber"),
	countryOfResidence: text("countryOfResidence"),
	hasAcceptedMLHCodeOfConduct: integer("hasAcceptedMLHCodeOfConduct", { mode: "boolean" }).notNull(),
	hasSharedDataWithMLH: integer("hasSharedDataWithMLH", { mode: "boolean" }).notNull(),
	isEmailable: integer("isEmailable", { mode: "boolean" }).notNull(),
	completedAt: integer("completedAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
});

export const coreHacker = sqliteTable("core_hacker", {
	authId: text("authId").primaryKey().notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	university: text("university").notNull(),
	major: text("major").notNull(),
	schoolId: text("schoolId"),
	levelOfStudy: text("levelOfStudy").notNull(),
	hackathonsAttended: integer("hackathonsAttended").notNull(),
	softwareExperience: text("softwareExperience").notNull(),
	heardFrom: text("heardFrom"),
	githubUrl: text("githubUrl"),
	linkedInUrl: text("linkedInUrl"),
	personalWebsiteUrl: text("personalWebsiteUrl"),
	resumeUrl: text("resumeUrl"),
	group: text("group"),
	registeredAt: integer("registeredAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	core_hacker_registeredAt_idx: index("core_hacker_registeredAt_idx").on(table.registeredAt)
}));

export const coreRsvp = sqliteTable("core_rsvp", {
	authId: text("authId").primaryKey().notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	status: text("status").notNull(),
	waitlistPosition: integer("waitlistPosition"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
	confirmedAt: integer("confirmedAt", { mode: "timestamp" }),
	waitlistedAt: integer("waitlistedAt", { mode: "timestamp" }),
	cancelledAt: integer("cancelledAt", { mode: "timestamp" }),
	cancelledByAuthId: text("cancelledByAuthId").references(() => coreUser.authId, { onDelete: "set null" }),
	promotedAt: integer("promotedAt", { mode: "timestamp" }),
	promotedByAuthId: text("promotedByAuthId").references(() => coreUser.authId, { onDelete: "set null" })
}, (table) => ({
	core_rsvp_status_idx: index("core_rsvp_status_idx").on(table.status),
	core_rsvp_waitlistPosition_idx: index("core_rsvp_waitlistPosition_idx").on(table.waitlistPosition),
	core_rsvp_createdAt_idx: index("core_rsvp_createdAt_idx").on(table.createdAt),
	core_rsvp_updatedAt_idx: index("core_rsvp_updatedAt_idx").on(table.updatedAt)
}));

export const coreUserBan = sqliteTable("core_userBan", {
	authId: text("authId").primaryKey().notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	reason: text("reason"),
	bannedByAuthId: text("bannedByAuthId").notNull().references(() => coreUser.authId),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
});

export const coreEvent = sqliteTable("core_event", {
	id: text("id").primaryKey().notNull(),
	title: text("title").notNull(),
	startTime: integer("startTime", { mode: "timestamp" }).notNull(),
	endTime: integer("endTime", { mode: "timestamp" }).notNull(),
	location: text("location").notNull().default("TBD"),
	description: text("description").notNull(),
	type: text("type").notNull(),
	host: text("host"),
	hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	core_event_startTime_idx: index("core_event_startTime_idx").on(table.startTime),
	core_event_type_idx: index("core_event_type_idx").on(table.type),
	core_event_hidden_idx: index("core_event_hidden_idx").on(table.hidden)
}));

export const coreSetting = sqliteTable("core_setting", {
	key: text("key").primaryKey().notNull(),
	value: text("value", { mode: "json" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	createdByAuthId: text("createdByAuthId").references(() => coreUser.authId, { onDelete: "set null" }),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
	updatedByAuthId: text("updatedByAuthId").references(() => coreUser.authId, { onDelete: "set null" })
}, (table) => ({
	core_setting_updatedAt_idx: index("core_setting_updatedAt_idx").on(table.updatedAt),
	core_setting_updatedByAuthId_idx: index("core_setting_updatedByAuthId_idx").on(table.updatedByAuthId)
}));

export const coreEventScan = sqliteTable("core_eventScan", {
	id: text("id").primaryKey().notNull(),
	eventId: text("eventId").notNull().references(() => coreEvent.id, { onDelete: "cascade" }),
	authId: text("authId").notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	scannedByAuthId: text("scannedByAuthId").notNull().references(() => coreUser.authId),
	scannedAt: integer("scannedAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	core_eventScan_eventId_idx: index("core_eventScan_eventId_idx").on(table.eventId),
	core_eventScan_authId_idx: index("core_eventScan_authId_idx").on(table.authId),
	core_eventScan_eventId_authId_idx: index("core_eventScan_eventId_authId_idx").on(table.eventId, table.authId),
	core_eventScan_scannedAt_idx: index("core_eventScan_scannedAt_idx").on(table.scannedAt)
}));

export const coreNotificationIntent = sqliteTable("core_notificationIntent", {
	id: text("id").primaryKey().notNull(),
	kind: text("kind").notNull(),
	recipientAuthId: text("recipientAuthId").references(() => coreUser.authId, { onDelete: "set null" }),
	payload: text("payload", { mode: "json" }).notNull().default({}),
	status: text("status").notNull().default("pending"),
	idempotencyKey: text("idempotencyKey").unique(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	core_notificationIntent_kind_idx: index("core_notificationIntent_kind_idx").on(table.kind),
	core_notificationIntent_recipientAuthId_idx: index("core_notificationIntent_recipientAuthId_idx").on(table.recipientAuthId),
	core_notificationIntent_status_idx: index("core_notificationIntent_status_idx").on(table.status),
	core_notificationIntent_createdAt_idx: index("core_notificationIntent_createdAt_idx").on(table.createdAt)
}));

export const coreNotificationDeliveryAttempt = sqliteTable("core_notificationDeliveryAttempt", {
	id: text("id").primaryKey().notNull(),
	intentId: text("intentId").notNull().references(() => coreNotificationIntent.id, { onDelete: "cascade" }),
	channel: text("channel").notNull(),
	provider: text("provider"),
	status: text("status").notNull(),
	recipient: text("recipient"),
	externalId: text("externalId"),
	error: text("error"),
	metadata: text("metadata", { mode: "json" }).notNull().default({}),
	attemptedAt: integer("attemptedAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	core_notificationDeliveryAttempt_intentId_idx: index("core_notificationDeliveryAttempt_intentId_idx").on(table.intentId),
	core_notificationDeliveryAttempt_channel_idx: index("core_notificationDeliveryAttempt_channel_idx").on(table.channel),
	core_notificationDeliveryAttempt_status_idx: index("core_notificationDeliveryAttempt_status_idx").on(table.status),
	core_notificationDeliveryAttempt_attemptedAt_idx: index("core_notificationDeliveryAttempt_attemptedAt_idx").on(table.attemptedAt)
}));

export const teamsTeam = sqliteTable("teams_team", {
	id: text("id").primaryKey().notNull(),
	name: text("name").notNull(),
	tag: text("tag").notNull().unique(),
	ownerAuthId: text("ownerAuthId").notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	teams_team_tag_idx: index("teams_team_tag_idx").on(table.tag),
	teams_team_ownerAuthId_idx: index("teams_team_ownerAuthId_idx").on(table.ownerAuthId)
}));

export const teamsMember = sqliteTable("teams_member", {
	id: text("id").primaryKey().notNull(),
	teamId: text("teamId").notNull().references(() => teamsTeam.id, { onDelete: "cascade" }),
	authId: text("authId").notNull().unique().references(() => coreUser.authId, { onDelete: "cascade" }),
	joinedAt: integer("joinedAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	teams_member_teamId_idx: index("teams_member_teamId_idx").on(table.teamId),
	teams_member_authId_idx: index("teams_member_authId_idx").on(table.authId)
}));

export const teamsInvite = sqliteTable("teams_invite", {
	id: text("id").primaryKey().notNull(),
	teamId: text("teamId").notNull().references(() => teamsTeam.id, { onDelete: "cascade" }),
	inviteeAuthId: text("inviteeAuthId").notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	status: text("status").notNull().default("pending"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	teams_invite_teamId_idx: index("teams_invite_teamId_idx").on(table.teamId),
	teams_invite_inviteeAuthId_idx: index("teams_invite_inviteeAuthId_idx").on(table.inviteeAuthId),
	teams_invite_teamId_inviteeAuthId_idx: index("teams_invite_teamId_inviteeAuthId_idx").on(table.teamId, table.inviteeAuthId)
}));

export const discordVerification = sqliteTable("discord_verification", {
	code: text("code").primaryKey().notNull(),
	discordUserId: text("discordUserId").notNull(),
	guildId: text("guildId").notNull(),
	username: text("username").notNull(),
	avatarHash: text("avatarHash"),
	authId: text("authId").references(() => coreUser.authId, { onDelete: "set null" }),
	status: text("status").notNull().default("pending"),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	acceptedAt: integer("acceptedAt", { mode: "timestamp" })
}, (table) => ({
	discord_verification_discordUserId_idx: index("discord_verification_discordUserId_idx").on(table.discordUserId),
	discord_verification_guildId_idx: index("discord_verification_guildId_idx").on(table.guildId),
	discord_verification_authId_idx: index("discord_verification_authId_idx").on(table.authId),
	discord_verification_status_idx: index("discord_verification_status_idx").on(table.status),
	discord_verification_createdAt_idx: index("discord_verification_createdAt_idx").on(table.createdAt)
}));

export const discordMember = sqliteTable("discord_member", {
	authId: text("authId").primaryKey().notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	discordUserId: text("discordUserId").notNull().unique(),
	guildId: text("guildId").notNull(),
	username: text("username").notNull(),
	avatarHash: text("avatarHash"),
	verifiedAt: integer("verifiedAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
	lastRoleSyncAt: integer("lastRoleSyncAt", { mode: "timestamp" })
}, (table) => ({
	discord_member_discordUserId_idx: index("discord_member_discordUserId_idx").on(table.discordUserId),
	discord_member_guildId_idx: index("discord_member_guildId_idx").on(table.guildId),
	discord_member_updatedAt_idx: index("discord_member_updatedAt_idx").on(table.updatedAt)
}));

export const discordRoleSyncAttempt = sqliteTable("discord_roleSyncAttempt", {
	id: text("id").primaryKey().notNull(),
	authId: text("authId").notNull().references(() => coreUser.authId, { onDelete: "cascade" }),
	discordUserId: text("discordUserId").notNull(),
	guildId: text("guildId").notNull(),
	status: text("status").notNull(),
	roleIds: text("roleIds", { mode: "json" }).notNull().default([]),
	roleNames: text("roleNames", { mode: "json" }).notNull().default([]),
	error: text("error"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
}, (table) => ({
	discord_roleSyncAttempt_authId_idx: index("discord_roleSyncAttempt_authId_idx").on(table.authId),
	discord_roleSyncAttempt_discordUserId_idx: index("discord_roleSyncAttempt_discordUserId_idx").on(table.discordUserId),
	discord_roleSyncAttempt_status_idx: index("discord_roleSyncAttempt_status_idx").on(table.status),
	discord_roleSyncAttempt_createdAt_idx: index("discord_roleSyncAttempt_createdAt_idx").on(table.createdAt)
}));
