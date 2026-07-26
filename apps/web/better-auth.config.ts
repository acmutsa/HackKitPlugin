import { createClient } from "@libsql/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/libsql";
import { hackkit } from "@hackkit/auth-better-auth";
import { resolveHackkitConfig } from "@hackkit/config";
import hackkitConfig from "./hackkit.config";

// Keep database-affecting Better Auth plugins in sync with lib/auth.ts.
// Runtime-only plugins such as nextCookies do not contribute schema.
export const auth = betterAuth({
	baseURL: "http://localhost:3000",
	database: drizzleAdapter(drizzle(createClient({ url: ":memory:" })), {
		provider: "sqlite",
	}),
	plugins: [hackkit(resolveHackkitConfig(hackkitConfig))],
});
