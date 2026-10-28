import { test, expect } from "../support/fixtures";
import { signup, completeRegistration } from "../support/accounts";
import { signIn } from "../support/browser";

test("team creation, invitation and acceptance across separate sessions", async ({
	app,
	browser,
	request,
	page,
	extraHTTPHeaders,
}) => {
	test.skip(
		app.template.id !== "full",
		"Teams is included only in the full template.",
	);
	const owner = await signup(request, app.baseURL);
	const teammate = await signup(request, app.baseURL);
	await completeRegistration(app.baseURL, owner);
	await completeRegistration(app.baseURL, teammate);
	await signIn(page, owner);
	await page.goto("/teams");
	const teamName = `Team ${owner.tag}`;
	await page.getByLabel("Team name").fill(teamName);
	await page.getByLabel("Team tag").fill(`t-${owner.tag}`);
	await page
		.getByRole("button", { name: "Create team", exact: true })
		.click();
	await expect(page.getByRole("heading", { name: teamName })).toBeVisible();
	await page.getByLabel("HackTag", { exact: true }).fill(teammate.tag);
	await page.getByRole("button", { name: "Send invite" }).click();
	await expect(page.getByText("Invite sent.", { exact: true })).toBeVisible();
	const context = await browser.newContext({
		baseURL: app.baseURL,
		extraHTTPHeaders,
	});
	try {
		const memberPage = await context.newPage();
		await signIn(memberPage, teammate);
		await memberPage.goto("/invites");
		await memberPage
			.getByRole("button", { name: "Accept", exact: true })
			.click();
		await memberPage.goto("/teams");
		await expect(
			memberPage.getByRole("heading", { name: teamName }),
		).toBeVisible();
		await page.reload();
		await expect(
			page
				.getByRole("list", { name: "Team members" })
				.getByText(teammate.name, { exact: true }),
		).toBeVisible();
	} finally {
		await context.close();
	}
});
