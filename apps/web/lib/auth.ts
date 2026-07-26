import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { hackkit, toBetterAuthLogger } from "@hackkit/auth-better-auth";
import { getDb } from "./db";
import { getAppLogger } from "./logger";
import { env } from "../env";
import * as schema from "../db/schema/auth";
import { appConfig } from "./app-config";

const socialProviders = {
	...(env.githubClientId && env.githubClientSecret
		? {
				github: {
					clientId: env.githubClientId,
					clientSecret: env.githubClientSecret,
				},
			}
		: {}),
	...(env.googleClientId && env.googleClientSecret
		? {
				google: {
					clientId: env.googleClientId,
					clientSecret: env.googleClientSecret,
				},
			}
		: {}),
};

export const auth = betterAuth({
	baseURL: env.betterAuthUrl,
	secret: env.betterAuthSecret,
	trustedOrigins: env.betterAuthTrustedOrigins,
	database: drizzleAdapter(getDb(), {
		provider: "sqlite",
		schema,
		camelCase: true,
	}),
	emailAndPassword: {
		enabled: true,
	},
	socialProviders,
	plugins: [hackkit(appConfig), nextCookies()],
	logger: toBetterAuthLogger(getAppLogger()),
});

export async function getAuthSession() {
	return auth.api.getSession({ headers: await headers() });
}
