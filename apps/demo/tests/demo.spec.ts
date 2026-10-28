import { test, expect } from "@playwright/test";
import { z } from "zod";
import { demoPassword } from "../lib/demo-accounts";

const sessionSchema = z.object({
	user: z.object({ email: z.string().email() }),
});
const uploadTargetSchema = z.object({
	uploadUrl: z.string().url(),
	storedFileReference: z.string(),
});

test("launcher opens the participant, organizer, and onboarding experiences", async ({
	page,
}) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", {
			name: "A hackathon, from application to check-in.",
		}),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Explore as a participant" })
		.click();
	await expect(page).toHaveURL(/\/dashboard$/);
	await page.goto("/teams");
	await expect(
		page.getByRole("heading", { name: "Your team" }).first(),
	).toBeVisible();
	await page.goto("/");
	await page.getByRole("button", { name: "Explore as an organizer" }).click();
	await expect(page).toHaveURL(/\/admin$/);
	await page.goto("/admin/users");
	await expect(page.getByText("Taylor Morgan").first()).toBeVisible();
	await page.goto("/schedule");
	await expect(
		page.getByText("Build your first HackKit plugin").first(),
	).toBeVisible();
	await page.goto("/");
	await page.getByRole("button", { name: "Try registration" }).click();
	await expect(page).toHaveURL(/\/onboarding\/hacktag$/);
	const tag = `wk${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
	const session = sessionSchema.parse(
		await (await page.request.get("/api/auth/get-session")).json(),
	);
	await page.getByLabel("HackTag", { exact: true }).fill(tag);
	await page.getByRole("button", { name: "Claim HackTag" }).click();
	await expect(page).toHaveURL(/\/onboarding\/user-data$/);
	await page.getByLabel("Age", { exact: true }).fill("22");
	for (const [label, option] of [
		["Gender", "Prefer not to answer"],
		["Race", "Prefer not to answer"],
		["Ethnicity", "Prefer not to answer"],
		["Shirt size", "Medium"],
		["Country of residence", "United States"],
	]) {
		await page.getByRole("combobox", { name: label, exact: true }).click();
		await page.getByRole("option", { name: option, exact: true }).click();
	}
	await page
		.getByRole("checkbox", { name: "No dietary restrictions", exact: true })
		.check();
	await page
		.getByRole("checkbox", {
			name: "I have read and agree to the MLH Code of Conduct.",
		})
		.check();
	await page.getByRole("checkbox", { name: /I authorize sharing/ }).check();
	await page
		.getByRole("checkbox", { name: /I agree to receive email/ })
		.check();
	await page.getByRole("button", { name: "Save user data" }).click();
	await expect(page).toHaveURL(/\/onboarding\/hacker$/);
	for (const [label, option] of [
		["University", "University of Texas at San Antonio"],
		["Major", "Computer Science"],
		["Level of study", "Freshman"],
		["Software experience", "Beginner"],
	]) {
		await page.getByRole("combobox", { name: label, exact: true }).click();
		await page.getByRole("option", { name: option, exact: true }).click();
	}
	await page.getByLabel("Hackathons attended", { exact: true }).fill("0");
	await page.getByLabel("Resume (optional, PDF)").setInputFiles({
		name: "fictional-resume.pdf",
		mimeType: "application/pdf",
		buffer: Buffer.from("%PDF-1.4 fictional browser upload"),
	});
	const uploadRegistration = page.waitForResponse(
		(response) =>
			response.url().includes("/api/files/register") &&
			response.request().method() === "POST",
	);
	await page.getByRole("button", { name: "Complete registration" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
	const upload = uploadTargetSchema.parse(
		await (await uploadRegistration).json(),
	);
	const ownerRead = await page.request.get(upload.storedFileReference);
	expect(ownerRead.status()).toBe(200);
	expect(await ownerRead.text()).toContain("fictional browser upload");
	await page.getByRole("button", { name: "Open account menu" }).click();
	await page.getByRole("menuitem", { name: "Log out" }).click();
	await expect(page).toHaveURL(/\/sign-in$/);
	await page.getByLabel("Email", { exact: true }).fill(session.user.email);
	await page.getByLabel("Password", { exact: true }).fill(demoPassword);
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.goto("/settings/registration");
	await expect(
		page.getByRole("combobox", { name: "University", exact: true }),
	).toContainText("University of Texas at San Antonio");
});

test("Worker sessions stay independent and private R2 uploads enforce ownership", async ({
	browser,
	baseURL,
}) => {
	const participant = await browser.newContext({ baseURL });
	const teammate = await browser.newContext({ baseURL });
	const organizer = await browser.newContext({ baseURL });
	const anonymous = await browser.newContext({ baseURL });
	const contexts = [participant, teammate, organizer, anonymous];
	const headers = { origin: baseURL! };
	try {
		for (const [context, email] of [
			[participant, "alex@example.com"],
			[teammate, "taylor@example.com"],
			[organizer, "sam@example.com"],
		] as const) {
			const login = await context.request.post(
				"/api/auth/sign-in/email",
				{
					headers,
					data: { email, password: demoPassword },
					timeout: 20_000,
				},
			);
			expect(login.status()).toBe(200);
		}
		// Repeated, concurrent requests catch HTTP clients retaining another
		// Worker invocation's stream state.
		for (let round = 0; round < 2; round++) {
			const sessions = await Promise.all(
				[participant, teammate].map((context) =>
					context.request.get("/api/auth/get-session", {
						timeout: 20_000,
					}),
				),
			);
			const users = await Promise.all(
				sessions.map(async (response) => {
					expect(response.status()).toBe(200);
					return sessionSchema.parse(await response.json()).user
						.email;
				}),
			);
			expect(users).toEqual(["alex@example.com", "taylor@example.com"]);
		}
		const blocked = await participant.request.post(
			"/api/hackkit/settings/list",
			{ headers },
		);
		expect(blocked.status()).toBe(403);
		const protectedPage = await anonymous.request.get("/admin", {
			maxRedirects: 0,
		});
		expect(protectedPage.status()).toBe(307);
		expect(protectedPage.headers().location).toContain("/sign-in");
		const anonymousUpload = await anonymous.request.post(
			"/api/files/register",
			{
				headers,
				data: { location: "profile-photos", fileName: "sample.png" },
			},
		);
		expect(anonymousUpload.status()).toBe(401);
		for (const location of ["profile-photos", "resumes"] as const) {
			const registration = await organizer.request.post(
				"/api/files/register",
				{
					headers,
					data: {
						location,
						fileName:
							location === "resumes"
								? "sample.pdf"
								: "sample.png",
					},
				},
			);
			expect(registration.status()).toBe(200);
			const target = uploadTargetSchema.parse(await registration.json());
			const upload = await organizer.request.put(target.uploadUrl, {
				headers: {
					...headers,
					"content-type":
						location === "resumes"
							? "application/pdf"
							: "image/png",
				},
				data: Buffer.from(
					location === "resumes"
						? "%PDF-1.4 fictional resume"
						: "fictional profile photo",
				),
			});
			expect(upload.status()).toBe(204);
			const spoof = await participant.request.put(target.uploadUrl, {
				headers,
				data: "overwrite",
			});
			expect(spoof.status()).toBe(403);
			const read = await organizer.request.get(
				target.storedFileReference,
			);
			expect(read.status()).toBe(200);
			expect(await read.text()).toContain("fictional");
			const anonymousRead = await anonymous.request.get(
				target.storedFileReference,
			);
			expect(anonymousRead.status()).toBe(
				location === "resumes" ? 401 : 200,
			);
			if (location === "resumes") {
				const participantRead = await participant.request.get(
					target.storedFileReference,
				);
				expect(participantRead.status()).toBe(401);
			}
		}
	} finally {
		await Promise.all(contexts.map((context) => context.close()));
	}
});
