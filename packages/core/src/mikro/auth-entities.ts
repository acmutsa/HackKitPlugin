import { defineEntity, p } from "@mikro-orm/core";

import { HackKitUser } from "../models.js";

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
				.manyToOne(HackKitUser)
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
				.manyToOne(HackKitUser)
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

export const authEntities = [AuthSession, AuthAccount, AuthVerification];
