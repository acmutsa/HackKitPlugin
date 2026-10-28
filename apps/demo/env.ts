// Worker secrets are exposed through process.env by nodejs_compat. Node scripts
// explicitly load .dev.vars before importing the application configuration.
export const env = {
	appUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
	betterAuthUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
	betterAuthSecret: process.env.BETTER_AUTH_SECRET,
	databaseUrl: process.env.TURSO_DATABASE_URL,
	tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
};

export function assertDemoEnvironment() {
	if (!env.databaseUrl || !/^(libsql|https?):\/\//.test(env.databaseUrl))
		throw new Error(
			"Set TURSO_DATABASE_URL in apps/demo/.dev.vars or Worker secrets.",
		);
	if (!env.tursoAuthToken)
		throw new Error(
			"Set TURSO_AUTH_TOKEN in apps/demo/.dev.vars or Worker secrets.",
		);
	if (!env.betterAuthSecret || env.betterAuthSecret.length < 32)
		throw new Error(
			"Set BETTER_AUTH_SECRET to a random value of at least 32 characters.",
		);
	new URL(env.appUrl);
}
