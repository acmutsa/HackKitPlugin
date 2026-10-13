import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

// Exercise the production build against a new disposable database on every run.
const directory = await mkdtemp(join(tmpdir(), "hackkit-http-"));
const port = 33017;
const baseURL = `http://127.0.0.1:${port}`;
const env = {
	PATH: process.env.PATH,
	NODE_ENV: "production",
	NEXT_TELEMETRY_DISABLED: "1",
	DATABASE_URL: `file:${join(directory, "web.db")}`,
	HACKKIT_DATABASE_DIALECT: "sqlite",
	NEXT_PUBLIC_APP_URL: baseURL,
	BETTER_AUTH_URL: baseURL,
	BETTER_AUTH_SECRET: "isolated-http-test-secret-with-at-least-32-characters",
	HACKKIT_EMAIL_PROVIDER: "none",
	HACKKIT_BLOB_ADAPTER: "s3",
	HACKKIT_S3_BUCKET: "test",
	HACKKIT_S3_REGION: "auto",
	HACKKIT_S3_ENDPOINT: "https://example.invalid",
	HACKKIT_S3_ACCESS_KEY_ID: "test",
	HACKKIT_S3_SECRET_ACCESS_KEY: "test",
	DISCORD_GUILD_ID: "test",
	DISCORD_BOT_API_URL: "https://example.invalid",
	DISCORD_INTERNAL_AUTH_KEY: "test",
	DISCORD_PARTICIPANT_ROLE_ID: "test",
};

async function run(...args) {
	const command = spawn(process.execPath, args, { env, stdio: "inherit" });
	const [code] = await once(command, "exit");
	assert.equal(code, 0, `Command failed: ${args.join(" ")}`);
}

let server;
try {
	const cli = join(
		process.cwd(),
		"node_modules/@hackkit/cli/bin/hackkit.mjs",
	);
	await run(cli, "db", "migrate");
	await run(cli, "db", "seed");
	server = spawn(
		process.execPath,
		[
			fileURLToPath(import.meta.resolve("next/dist/bin/next")),
			"start",
			"-p",
			String(port),
			"-H",
			"127.0.0.1",
		],
		{ env, stdio: "inherit" },
	);
	let ready = false;
	for (let attempt = 0; attempt < 40; attempt++) {
		if (server.exitCode !== null)
			throw new Error("Next exited before becoming ready.");
		try {
			const response = await fetch(`${baseURL}/api/auth/get-session`);
			ready = response.ok;
		} catch {
			/* Server may still be starting. */
		}
		if (ready) break;
		await setTimeout(250);
	}
	assert.ok(ready, "Next did not become ready.");

	const accounts = [];
	for (const name of ["First", "Second"]) {
		const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: baseURL },
			body: JSON.stringify({
				name: `HTTP ${name}`,
				email: `${name.toLowerCase()}@example.com`,
				password: "a sufficiently long password",
			}),
		});
		assert.equal(response.status, 200);
		const body = await response.json();
		const cookie = response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		assert.ok(cookie.includes("better-auth.session_token="));
		accounts.push({ id: body.user.id, cookie });
	}

	for (const account of accounts) {
		const headers = { cookie: account.cookie };
		const session = await fetch(`${baseURL}/api/auth/get-session`, {
			headers,
		}).then((response) => response.json());
		assert.equal(session.user.id, account.id);
		const page = await fetch(`${baseURL}/onboarding/hacktag`, {
			headers,
			redirect: "manual",
		});
		assert.equal(page.status, 200);
		assert.ok(!(await page.text()).includes("data-next-error-message"));
		const forbidden = await fetch(`${baseURL}/api/admin/export`, {
			headers,
		});
		assert.equal(forbidden.status, 403);
	}
	assert.equal(
		await fetch(`${baseURL}/api/auth/get-session`).then((response) =>
			response.json(),
		),
		null,
	);
	assert.equal(
		(await fetch(`${baseURL}/dashboard`, { redirect: "manual" })).status,
		307,
	);
	assert.equal((await fetch(`${baseURL}/api/admin/export`)).status, 401);
	console.log(
		"Passed: HTTP signup, isolated sessions, onboarding rendering, permission denials, and anonymous redirects.",
	);
} finally {
	if (server && server.exitCode === null) {
		const exited = once(server, "exit");
		server.kill("SIGTERM");
		await exited;
	}
	await rm(directory, { recursive: true, force: true });
}
