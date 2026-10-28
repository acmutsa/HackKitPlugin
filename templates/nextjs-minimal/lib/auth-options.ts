import type { HackKitAuthOptions } from "@hackkit/core";
import { env } from "../env";
export const authOptions = {
	baseURL: env.betterAuthUrl,
	secret: env.betterAuthSecret,
	trustedOrigins: env.betterAuthTrustedOrigins,
	emailAndPassword: { enabled: true },
} satisfies HackKitAuthOptions;
