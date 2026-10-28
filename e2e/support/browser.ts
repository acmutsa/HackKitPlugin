import { expect, type Page } from "@playwright/test";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { e2eDirectory } from "./templates.mjs";
import type { startTemplate } from "./server.mjs";
import { accountDetails } from "./accounts";

const execute = promisify(execFile);
export async function databaseAction(
	app: Awaited<ReturnType<typeof startTemplate>>,
	action: "promote" | "approval",
	userId: string,
	value?: boolean,
) {
	await execute(
		process.execPath,
		[
			join(e2eDirectory, "support/database-task.mjs"),
			action,
			userId,
			...(value === undefined ? [] : [String(value)]),
		],
		{ cwd: app.template.directory, env: app.env, timeout: 30000 },
	);
}

export async function signIn(
	page: Page,
	account: ReturnType<typeof accountDetails>,
) {
	await page.goto("/sign-in");
	await page.getByLabel("Email", { exact: true }).fill(account.email);
	await page.getByLabel("Password", { exact: true }).fill(account.password);
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
}

async function select(page: Page, label: string, option: string) {
	await page.getByRole("combobox", { name: label, exact: true }).click();
	await page.getByRole("option", { name: option, exact: true }).click();
}

/** Exercise every form through the browser instead of bypassing registration. */
export async function registerThroughUI(
	page: Page,
	account: ReturnType<typeof accountDetails>,
) {
	await page.goto("/sign-up");
	await page.getByLabel("Name", { exact: true }).fill(account.name);
	await page.getByLabel("Email", { exact: true }).fill(account.email);
	await page.getByLabel("Password", { exact: true }).fill(account.password);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/onboarding\/hacktag$/);
	await page.getByLabel("HackTag", { exact: true }).fill(account.tag);
	await page.getByRole("button", { name: "Claim HackTag" }).click();
	await expect(page).toHaveURL(/\/onboarding\/user-data$/);
	await page.getByLabel("Age", { exact: true }).fill("22");
	await select(page, "Gender", "Prefer not to answer");
	await select(page, "Race", "Prefer not to answer");
	await select(page, "Ethnicity", "Prefer not to answer");
	await select(page, "Shirt size", "Medium");
	await select(page, "Country of residence", "United States");
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
	await select(page, "University", "University of Texas at San Antonio");
	await select(page, "Major", "Computer Science");
	await select(page, "Level of study", "Freshman");
	await page.getByLabel("Hackathons attended", { exact: true }).fill("0");
	await select(page, "Software experience", "Beginner");
	await page.getByRole("button", { name: "Complete registration" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
}
