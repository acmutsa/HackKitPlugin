import { test, expect } from "../support/fixtures";
import { signup, clientFor, completeRegistration } from "../support/accounts";

test("production HTTP auth, request isolation, permissions, Core and plugin transport", async ({
	app,
	request,
}) => {
	const accounts = await Promise.all([
		signup(request, app.baseURL),
		signup(request, app.baseURL),
	]);
	for (const account of accounts) {
		const headers = { cookie: account.cookie };
		const session = await request.get("/api/auth/get-session", { headers });
		expect(await session.json()).toMatchObject({
			user: { id: account.id },
		});
		const page = await request.get("/onboarding/hacktag", { headers });
		expect(page.status()).toBe(200);
		expect(await page.text()).not.toContain("data-next-error-message");
		expect(
			(await request.get("/api/admin/export", { headers })).status(),
		).toBe(403);
	}
	// Explicit empty cookies avoid the request fixture's signup cookie jar.
	expect(
		await (
			await request.get("/api/auth/get-session", {
				headers: { cookie: "" },
			})
		).json(),
	).toBeNull();
	expect(
		(
			await request.get("/dashboard", {
				headers: { cookie: "" },
				maxRedirects: 0,
			})
		).status(),
	).toBe(307);
	expect(
		(
			await request.get("/api/admin/export", { headers: { cookie: "" } })
		).status(),
	).toBe(401);
	const claimed = await Promise.all(
		accounts.map((account) =>
			clientFor(app.baseURL, account.cookie)(
				"@post/users/claim-hack-tag",
				{ body: { hackTag: account.tag } },
			),
		),
	);
	expect(claimed.map((result) => result.data?.id)).toEqual(
		accounts.map((account) => account.id),
	);
	expect(typeof claimed[0]?.data?.createdAt).toBe("string");
	expect(
		(
			await clientFor(app.baseURL)("@post/users/claim-hack-tag", {
				body: { hackTag: "anonymous" },
			})
		).error,
	).toMatchObject({ code: "UNAUTHORIZED", status: 401 });
	expect(
		(
			await clientFor(app.baseURL, accounts[0].cookie)(
				"@post/roles/create",
				{ body: { name: "Forbidden", position: 0, permissions: [] } },
			)
		).error,
	).toMatchObject({ status: 403 });
	const spoof = await request.post("/api/hackkit/users/claim-hack-tag", {
		headers: { cookie: accounts[0].cookie, origin: app.baseURL },
		data: { hackTag: "spoof", authId: accounts[1].id },
	});
	expect(spoof.status()).toBe(400);
	for (const account of accounts)
		await completeRegistration(app.baseURL, account);
	if (app.template.id === "minimal") {
		for (const path of ["teams/create", "discord/confirm-verification"])
			expect(
				(
					await request.post(`/api/hackkit/${path}`, {
						headers: {
							cookie: accounts[0].cookie,
							origin: app.baseURL,
						},
						data: {},
					})
				).status(),
			).toBe(404);
		return;
	}
	const owner = clientFor(app.baseURL, accounts[0].cookie);
	const member = clientFor(app.baseURL, accounts[1].cookie);
	const created = await owner("@post/teams/create", {
		body: { name: "HTTP team", tag: `t-${accounts[0].tag}` },
	});
	expect(created.error).toBeNull();
	if (!created.data) throw new Error("Team creation returned no team.");
	expect(created.data.ownerAuthId).toBe(accounts[0].id);
	const invited = await owner("@post/teams/invite", {
		body: { teamId: created.data.id, hackTag: accounts[1].tag },
	});
	expect(invited.error).toBeNull();
	if (!invited.data) throw new Error("Invitation returned no invite.");
	expect(
		(
			await member("@post/teams/respond-to-invite", {
				body: { inviteId: invited.data.id, accept: true },
			})
		).error,
	).toBeNull();
	expect(await member("@post/teams/leave")).toEqual({
		data: null,
		error: null,
	});
	expect((await owner("@post/teams/leave")).error).toMatchObject({
		status: 422,
	});
	expect(
		(
			await owner("@post/discord/confirm-verification", {
				body: { code: "missing-code" },
			})
		).error,
	).toMatchObject({ status: 404 });
});

test("minimal local uploads roundtrip and preserve resume access checks", async ({
	app,
	request,
}) => {
	test.skip(
		app.template.id !== "minimal",
		"The full template uses S3 in production.",
	);
	const account = await signup(request, app.baseURL);
	const other = await signup(request, app.baseURL);
	expect(
		(
			await request.post("/api/files/register", {
				headers: { cookie: "" },
				data: { location: "resumes", fileName: "resume.pdf" },
			})
		).status(),
	).toBe(401);
	for (const location of ["resumes", "profile-photos"]) {
		const registration = await request.post("/api/files/register", {
			headers: { cookie: account.cookie },
			data: {
				location,
				fileName: location === "resumes" ? "resume.pdf" : "photo.png",
			},
		});
		expect(registration.status()).toBe(200);
		const target: unknown = await registration.json();
		if (
			!target ||
			typeof target !== "object" ||
			!("uploadUrl" in target) ||
			typeof target.uploadUrl !== "string" ||
			!("storedFileReference" in target) ||
			typeof target.storedFileReference !== "string"
		)
			throw new Error("Invalid local upload target.");
		expect(new URL(target.uploadUrl).origin).toBe(app.baseURL);
		const bytes = Buffer.from("E2E file upload");
		expect(
			(
				await request.put(target.uploadUrl, {
					headers: { cookie: "" },
					data: bytes,
				})
			).status(),
		).toBe(401);
		expect(
			(
				await request.put(target.uploadUrl, {
					headers: { cookie: account.cookie },
					data: bytes,
				})
			).status(),
		).toBe(204);
		if (location === "resumes") {
			await completeRegistration(
				app.baseURL,
				account,
				target.storedFileReference,
			);
			for (const cookie of ["", other.cookie])
				expect(
					(
						await request.get(target.storedFileReference, {
							headers: { cookie },
						})
					).status(),
				).toBe(401);
		} else {
			expect(
				(
					await request.get(target.storedFileReference, {
						headers: { cookie: "" },
					})
				).status(),
			).toBe(200);
		}
		const viewed = await request.get(target.storedFileReference, {
			headers: { cookie: account.cookie },
		});
		expect(viewed.status()).toBe(200);
		expect(await viewed.body()).toEqual(bytes);
	}
});
