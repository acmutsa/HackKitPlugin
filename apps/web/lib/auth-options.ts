import type { HackKitAuthOptions } from "@hackkit/core";
import { env } from "../env";

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

export const authOptions = {
	baseURL: env.betterAuthUrl,
	secret: env.betterAuthSecret,
	trustedOrigins: env.betterAuthTrustedOrigins,
	emailAndPassword: { enabled: true },
	socialProviders,
} satisfies HackKitAuthOptions;
