import { defineEntity, p } from "@mikro-orm/core";

export const CoreRole = defineEntity({
	name: "CoreRole",
	tableName: "core_role",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		name: p.string().unique(),
		position: p.integer(),
		permissions: p.json<`${string}.${string}`[]>().default([]),
		color: p.string().nullable(),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
	},
	indexes: [{ properties: ["position"] }],
});

export const HackKitUser = defineEntity({
	name: "HackKitUser",
	tableName: "core_user",
	properties: {
		id: p.string().primary(),
		name: p.string(),
		email: p.string().unique(),
		emailVerified: p.boolean().default(false),
		profilePhotoUrl: p.text().nullable(),
		hackTag: p.string().nullable().unique(),
		bio: p.text().nullable(),
		pronouns: p.string().nullable(),
		skills: p.json<string[]>().default([]),
		isProfileSearchable: p.boolean().default(true),
		discordDisplayHandle: p.string().nullable(),
		roleId: () =>
			p
				.manyToOne(CoreRole)
				.mapToPk()
				.fieldName("role_id")
				.nullable()
				.deleteRule("set null"),
		isApproved: p.boolean().default(false),
		checkedInAt: p.datetime().nullable(),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
	},
	indexes: [
		{ properties: ["hackTag"] },
		{ properties: ["roleId"] },
		{ properties: ["createdAt"] },
	],
});

export const CoreUserData = defineEntity({
	name: "CoreUserData",
	tableName: "core_user_data",
	properties: {
		authId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("auth_id")
				.primary()
				.deleteRule("cascade"),
		age: p.integer(),
		gender: p.string(),
		race: p.string(),
		ethnicity: p.string(),
		shirtSize: p.string(),
		dietaryRestrictions: p.json<string[]>().default([]),
		accommodationNote: p.text().nullable(),
		phoneNumber: p.string().nullable(),
		countryOfResidence: p.string().nullable(),
		hasAcceptedMLHCodeOfConduct: p.boolean(),
		hasSharedDataWithMLH: p.boolean(),
		isEmailable: p.boolean(),
		completedAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
	},
});

export const CoreHacker = defineEntity({
	name: "CoreHacker",
	tableName: "core_hacker",
	properties: {
		authId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("auth_id")
				.primary()
				.deleteRule("cascade"),
		university: p.string(),
		major: p.string(),
		schoolId: p.string().nullable(),
		levelOfStudy: p.string(),
		hackathonsAttended: p.integer(),
		softwareExperience: p.string(),
		heardFrom: p.string().nullable(),
		githubUrl: p.text().nullable(),
		linkedInUrl: p.text().nullable(),
		personalWebsiteUrl: p.text().nullable(),
		resumeUrl: p.text().nullable(),
		group: p.string().nullable(),
		registeredAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
	},
	indexes: [{ properties: ["registeredAt"] }],
});

export const CoreRsvp = defineEntity({
	name: "CoreRsvp",
	tableName: "core_rsvp",
	properties: {
		authId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("auth_id")
				.primary()
				.deleteRule("cascade"),
		status: p.enum(["confirmed", "waitlisted", "cancelled"] as const),
		waitlistPosition: p.integer().nullable(),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
		confirmedAt: p.datetime().nullable(),
		waitlistedAt: p.datetime().nullable(),
		cancelledAt: p.datetime().nullable(),
		cancelledByAuthId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("cancelled_by_auth_id")
				.nullable()
				.deleteRule("set null"),
		promotedAt: p.datetime().nullable(),
		promotedByAuthId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("promoted_by_auth_id")
				.nullable()
				.deleteRule("set null"),
	},
	indexes: [
		{ properties: ["status"] },
		{ properties: ["waitlistPosition"] },
		{ properties: ["createdAt"] },
		{ properties: ["updatedAt"] },
	],
});

export const CoreUserBan = defineEntity({
	name: "CoreUserBan",
	tableName: "core_user_ban",
	properties: {
		authId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("auth_id")
				.primary()
				.deleteRule("cascade"),
		reason: p.string().nullable(),
		bannedByAuthId: () =>
			p.manyToOne(HackKitUser).mapToPk().fieldName("banned_by_auth_id"),
		createdAt: p.datetime().onCreate(() => new Date()),
	},
});

export const CoreEvent = defineEntity({
	name: "CoreEvent",
	tableName: "core_event",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		title: p.string(),
		startTime: p.datetime(),
		endTime: p.datetime(),
		location: p.string().default("TBD"),
		description: p.text(),
		type: p.string(),
		host: p.string().nullable(),
		hidden: p.boolean().default(false),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
	},
	indexes: [
		{ properties: ["startTime"] },
		{ properties: ["type"] },
		{ properties: ["hidden"] },
	],
});

export const CoreSetting = defineEntity({
	name: "CoreSetting",
	tableName: "core_setting",
	properties: {
		key: p.string().primary(),
		value: p.json<unknown>(),
		createdAt: p.datetime().onCreate(() => new Date()),
		createdByAuthId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("created_by_auth_id")
				.nullable()
				.deleteRule("set null"),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
		updatedByAuthId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("updated_by_auth_id")
				.nullable()
				.deleteRule("set null"),
	},
	indexes: [
		{ properties: ["updatedAt"] },
		{ properties: ["updatedByAuthId"] },
	],
});

export const CoreEventScan = defineEntity({
	name: "CoreEventScan",
	tableName: "core_event_scan",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		eventId: () =>
			p
				.manyToOne(CoreEvent)
				.mapToPk()
				.fieldName("event_id")
				.deleteRule("cascade"),
		authId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("auth_id")
				.deleteRule("cascade"),
		scannedByAuthId: () =>
			p.manyToOne(HackKitUser).mapToPk().fieldName("scanned_by_auth_id"),
		scannedAt: p.datetime().onCreate(() => new Date()),
	},
	indexes: [
		{ properties: ["eventId"] },
		{ properties: ["authId"] },
		{ properties: ["eventId", "authId"] },
		{ properties: ["scannedAt"] },
	],
});

export const CoreNotificationIntent = defineEntity({
	name: "CoreNotificationIntent",
	tableName: "core_notification_intent",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		kind: p.string(),
		recipientAuthId: () =>
			p
				.manyToOne(HackKitUser)
				.mapToPk()
				.fieldName("recipient_auth_id")
				.nullable()
				.deleteRule("set null"),
		payload: p.json<Record<string, unknown>>().onCreate(() => ({})),
		status: p
			.enum([
				"pending",
				"processing",
				"delivered",
				"failed",
				"skipped",
			] as const)
			.default("pending"),
		idempotencyKey: p.string().nullable().unique(),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p
			.datetime()
			.onCreate(() => new Date())
			.onUpdate(() => new Date()),
	},
	indexes: [
		{ properties: ["kind"] },
		{ properties: ["recipientAuthId"] },
		{ properties: ["status"] },
		{ properties: ["createdAt"] },
	],
});

export const CoreNotificationDeliveryAttempt = defineEntity({
	name: "CoreNotificationDeliveryAttempt",
	tableName: "core_notification_delivery_attempt",
	properties: {
		id: p
			.string()
			.primary()
			.onCreate(() => crypto.randomUUID()),
		intentId: () =>
			p
				.manyToOne(CoreNotificationIntent)
				.mapToPk()
				.fieldName("intent_id")
				.deleteRule("cascade"),
		channel: p.string(),
		provider: p.string().nullable(),
		status: p.enum(["delivered", "failed", "skipped"] as const),
		recipient: p.string().nullable(),
		externalId: p.string().nullable(),
		error: p.text().nullable(),
		metadata: p.json<Record<string, unknown>>().onCreate(() => ({})),
		attemptedAt: p.datetime().onCreate(() => new Date()),
	},
	indexes: [
		{ properties: ["intentId"] },
		{ properties: ["channel"] },
		{ properties: ["status"] },
		{ properties: ["attemptedAt"] },
	],
});

// Updating a named row serializes domain decisions that depend on row counts.
export const CoreOperationLock = defineEntity({
	name: "CoreOperationLock",
	tableName: "core_operation_lock",
	properties: {
		key: p.string().primary(),
		token: p.string(),
	},
});

export const coreModels = {
	operationLock: CoreOperationLock,
	user: HackKitUser,
	userData: CoreUserData,
	hacker: CoreHacker,
	rsvp: CoreRsvp,
	role: CoreRole,
	userBan: CoreUserBan,
	event: CoreEvent,
	setting: CoreSetting,
	eventScan: CoreEventScan,
	notificationIntent: CoreNotificationIntent,
	notificationDeliveryAttempt: CoreNotificationDeliveryAttempt,
} as const;
