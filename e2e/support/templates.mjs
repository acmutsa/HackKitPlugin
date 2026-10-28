import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
export const e2eDirectory = join(repositoryRoot, "e2e");
export const templates = {
	full: {
		id: "full",
		directory: join(repositoryRoot, "templates/nextjs-full"),
		packageName: "@hackkit/template-nextjs-full",
		dialects: ["sqlite", "libsql", "postgresql", "mysql"],
		port: 33017,
		origin: "http://127.0.0.1:33017",
	},
	minimal: {
		id: "minimal",
		directory: join(repositoryRoot, "templates/nextjs-minimal"),
		packageName: "@hackkit/template-nextjs-minimal",
		dialects: ["sqlite"],
		port: 33018,
		origin: "http://127.0.0.1:33018",
	},
};

/** Use explicit values so Next's dotenv loader cannot select developer services. */
export function testEnvironment(template, directory) {
	const common = {
		PATH: process.env.PATH,
		HOME: process.env.HOME,
		TMPDIR: tmpdir(),
		...(process.env.SystemRoot === undefined
			? {}
			: { SystemRoot: process.env.SystemRoot }),
		NODE_ENV: "production",
		NEXT_TELEMETRY_DISABLED: "1",
		DATABASE_URL: `file:${join(directory, "web.db")}`,
		HACKKIT_DATABASE_DIALECT: "sqlite",
		HACKKIT_MIGRATIONS_PATH: join(directory, "migrations"),
		HACKKIT_LOCAL_BLOB_BASE_DIR: join(directory, "uploads"),
		NEXT_PUBLIC_APP_URL: template.origin,
		BETTER_AUTH_URL: template.origin,
		BETTER_AUTH_SECRET: "isolated-e2e-secret-with-at-least-32-characters",
		BETTER_AUTH_TRUSTED_ORIGINS: template.origin,
	};
	if (template.id === "minimal") return common;
	return {
		...common,
		HACKKIT_EMAIL_PROVIDER: "none",
		GITHUB_CLIENT_ID: "",
		GITHUB_CLIENT_SECRET: "",
		GOOGLE_CLIENT_ID: "",
		GOOGLE_CLIENT_SECRET: "",
		TURSO_AUTH_TOKEN: "",
		RESEND_API_KEY: "",
		SMTP_HOST: "",
		SMTP_PORT: "",
		SMTP_SECURE: "false",
		HACKKIT_EMAIL_FROM: "HackKit <e2e@example.com>",
		HACKKIT_EMAIL_REPLY_TO: "",
		SMTP_PASSWORD: "",
		SMTP_USERNAME: "",
		HACKKIT_BLOB_ADAPTER: template.id === "full" ? "s3" : "local",
		HACKKIT_S3_BUCKET: "e2e",
		HACKKIT_S3_REGION: "auto",
		HACKKIT_S3_ENDPOINT: "https://example.invalid",
		HACKKIT_S3_ACCESS_KEY_ID: "e2e",
		HACKKIT_S3_SECRET_ACCESS_KEY: "e2e",
		DISCORD_GUILD_ID: "e2e",
		DISCORD_VERIFICATION_BASE_URL: template.origin,
		DISCORD_PARTICIPANT_ROLE_NAME: "",
		DISCORD_BOT_API_URL: "https://example.invalid",
		DISCORD_INTERNAL_AUTH_KEY: "e2e",
		DISCORD_PARTICIPANT_ROLE_ID: "e2e",
	};
}
