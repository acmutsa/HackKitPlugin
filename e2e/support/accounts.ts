import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { createHackkitClient } from "@hackkit/core/http/client";
import type { TeamsEndpoints } from "@hackkit/plugin-teams/client";
import type { DiscordEndpoints } from "@hackkit/plugin-discord/client";

export function accountDetails() {
	const tag = `h-${randomUUID().slice(0, 8)}`;
	return {
		name: `Hacker ${tag}`,
		email: `${tag}@example.com`,
		password: "correct-horse-battery-staple",
		tag,
	};
}

export async function signup(request: APIRequestContext, baseURL: string) {
	const account = accountDetails();
	const response = await request.post(`${baseURL}/api/auth/sign-up/email`, {
		headers: { origin: baseURL },
		data: account,
	});
	expect(response.status(), await response.text()).toBe(200);
	const body: unknown = await response.json();
	if (
		!body ||
		typeof body !== "object" ||
		!("user" in body) ||
		!body.user ||
		typeof body.user !== "object" ||
		!("id" in body.user) ||
		typeof body.user.id !== "string"
	)
		throw new Error("Signup did not return a canonical user ID.");
	const cookie = response
		.headersArray()
		.filter((header) => header.name.toLowerCase() === "set-cookie")
		.map((header) => header.value.split(";")[0])
		.join("; ");
	expect(cookie).toContain("better-auth.session_token=");
	return { ...account, id: body.user.id, cookie };
}

export function clientFor(baseURL: string, cookie?: string) {
	return createHackkitClient<TeamsEndpoints & DiscordEndpoints>({
		baseURL: `${baseURL}/api/hackkit`,
		headers: { origin: baseURL, ...(cookie ? { cookie } : {}) },
	});
}

export async function completeRegistration(
	baseURL: string,
	account: Awaited<ReturnType<typeof signup>>,
	resumeUrl?: string,
) {
	const client = clientFor(baseURL, account.cookie);
	expect(
		(
			await client("@post/users/claim-hack-tag", {
				body: { hackTag: account.tag },
			})
		).error,
	).toBeNull();
	expect(
		(
			await client("@post/user-data/complete", {
				body: {
					age: 20,
					gender: "prefer_not_to_answer",
					race: "prefer_not_to_answer",
					ethnicity: "prefer_not_to_answer",
					shirtSize: "m",
					dietaryRestrictions: ["none"],
					hasAcceptedMLHCodeOfConduct: true,
					hasSharedDataWithMLH: true,
					isEmailable: true,
				},
			})
		).error,
	).toBeNull();
	expect(
		(
			await client("@post/hackers/register", {
				body: {
					university: "Test University",
					major: "CS",
					levelOfStudy: "undergraduate",
					hackathonsAttended: 0,
					softwareExperience: "beginner",
					resumeUrl,
				},
			})
		).error,
	).toBeNull();
}
