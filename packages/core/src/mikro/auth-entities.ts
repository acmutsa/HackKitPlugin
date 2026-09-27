import { defineEntity, p } from "@mikro-orm/core";

// These are Better Auth's default models. Changes to Better Auth options that add
// columns or plugins must regenerate the auth entities before a migration is made.
export const AuthUser = defineEntity({
	name: "AuthUser",
	tableName: "user",
	properties: {
		id: p.string().primary(),
		name: p.string(),
		email: p.string().unique(),
		emailVerified: p.boolean().default(false),
		image: p.text().nullable(),
		createdAt: p.datetime(),
		updatedAt: p.datetime(),
	},
});

export const AuthSession = defineEntity({
	name: "AuthSession",
	tableName: "session",
	properties: {
		id: p.string().primary(),
		expiresAt: p.datetime(),
		token: p.string().unique(),
		createdAt: p.datetime(),
		updatedAt: p.datetime(),
		ipAddress: p.string().nullable(),
		userAgent: p.text().nullable(),
		userId: () =>
			p
				.manyToOne(AuthUser)
				.mapToPk()
				.fieldName("user_id")
				.index()
				.deleteRule("cascade"),
	},
});

export const AuthAccount = defineEntity({
	name: "AuthAccount",
	tableName: "account",
	properties: {
		id: p.string().primary(),
		accountId: p.string(),
		providerId: p.string(),
		userId: () =>
			p
				.manyToOne(AuthUser)
				.mapToPk()
				.fieldName("user_id")
				.index()
				.deleteRule("cascade"),
		accessToken: p.text().nullable(),
		refreshToken: p.text().nullable(),
		idToken: p.text().nullable(),
		accessTokenExpiresAt: p.datetime().nullable(),
		refreshTokenExpiresAt: p.datetime().nullable(),
		scope: p.text().nullable(),
		password: p.string().nullable(),
		createdAt: p.datetime(),
		updatedAt: p.datetime(),
	},
});

export const AuthVerification = defineEntity({
	name: "AuthVerification",
	tableName: "verification",
	properties: {
		id: p.string().primary(),
		identifier: p.string().index(),
		value: p.text(),
		expiresAt: p.datetime(),
		createdAt: p.datetime().nullable(),
		updatedAt: p.datetime().nullable(),
	},
});

export const authEntities = [
	AuthUser,
	AuthSession,
	AuthAccount,
	AuthVerification,
];
