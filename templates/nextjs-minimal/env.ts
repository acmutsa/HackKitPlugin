function read(name: string) {
	const value = process.env[name]?.trim();
	return value || undefined;
}

export function resolveTemplateEnv() {
	const production = process.env.NODE_ENV === "production";
	const appUrl =
		read("NEXT_PUBLIC_APP_URL") ??
		read("BETTER_AUTH_URL") ??
		"http://localhost:3000";
	const betterAuthSecret =
		read("BETTER_AUTH_SECRET") ??
		"minimal-development-secret-change-me-please";
	if (production) {
		if (!read("NEXT_PUBLIC_APP_URL") && !read("BETTER_AUTH_URL"))
			throw new Error(
				"Set NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL in production.",
			);
		if (!read("BETTER_AUTH_SECRET") || betterAuthSecret.length < 32)
			throw new Error(
				"Set BETTER_AUTH_SECRET to at least 32 characters in production.",
			);
	}
	const databaseUrl = read("DATABASE_URL") ?? "file:.data/web.db";
	if (
		/^[a-z][a-z\d+.-]*:/i.test(databaseUrl) &&
		!databaseUrl.startsWith("file:") &&
		databaseUrl !== ":memory:"
	)
		throw new Error(
			"The minimal template requires a local SQLite DATABASE_URL.",
		);
	return {
		nodeEnv: production ? "production" : "development",
		appUrl,
		betterAuthUrl: read("BETTER_AUTH_URL") ?? appUrl,
		betterAuthSecret,
		betterAuthTrustedOrigins:
			read("BETTER_AUTH_TRUSTED_ORIGINS")
				?.split(",")
				.map((value) => value.trim())
				.filter(Boolean) ?? [],
		databaseUrl,
		localBlobBaseDir:
			read("HACKKIT_LOCAL_BLOB_BASE_DIR") ?? ".data/uploads",
	};
}
export const env = resolveTemplateEnv();
