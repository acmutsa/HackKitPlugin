import { test, expect } from "../support/fixtures";
import {
	accountDetails,
	signup,
	completeRegistration,
} from "../support/accounts";
import { registerThroughUI, signIn, databaseAction } from "../support/browser";

test("signup, onboarding, persisted registration, signout and signin", async ({
	page,
}) => {
	const account = accountDetails();
	await registerThroughUI(page, account);
	await expect(
		page.getByRole("heading", { name: `Welcome, ${account.name}` }),
	).toBeVisible();
	await page.getByRole("button", { name: "Open account menu" }).click();
	await page.getByRole("menuitem", { name: "Log out" }).click();
	await expect(page).toHaveURL(/\/sign-in$/);
	await signIn(page, account);
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.getByText(account.tag, { exact: true })).toBeVisible();
	await page.goto("/settings/registration");
	await expect(
		page.getByRole("combobox", { name: "University", exact: true }),
	).toContainText("University of Texas at San Antonio");
});

test("anonymous and incomplete accounts are redirected; participants cannot open admin pages", async ({
	app,
	page,
	request,
}) => {
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/sign-in(?:\?.*)?$/);
	const account = await signup(request, app.baseURL);
	await signIn(page, account);
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/onboarding\/hacktag$/);
	await completeRegistration(app.baseURL, account);
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/dashboard$/);
	const denied = await page.goto("/admin");
	expect(denied?.status()).toBe(404);
	await expect(
		page.getByRole("heading", { name: "Admin Overview" }),
	).not.toBeVisible();
});

test("a registered participant waits for approval when approval is required", async ({
	app,
	page,
	request,
}) => {
	const owner = await signup(request, app.baseURL);
	await databaseAction(app, "promote", owner.id);
	await databaseAction(app, "approval", owner.id, true);
	try {
		const account = await signup(request, app.baseURL);
		await completeRegistration(app.baseURL, account);
		await signIn(page, account);
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/i\/approval$/);
		await expect(
			page.getByRole("heading", {
				name: "Your account is awaiting approval.",
			}),
		).toBeVisible();
	} finally {
		await databaseAction(app, "approval", owner.id, false);
	}
});

test("a seeded owner can open basic administration", async ({
	app,
	page,
	request,
}) => {
	const owner = await signup(request, app.baseURL);
	await databaseAction(app, "promote", owner.id);
	await signIn(page, owner);
	for (const [path, heading] of [
		["/admin", "Admin Overview"],
		["/admin/users", "Users"],
		["/admin/roles", "Roles"],
		["/admin/settings", "Hackathon Settings"],
	]) {
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		await expect(
			page.getByRole("heading", { name: heading, exact: true }),
		).toBeVisible();
	}
});
