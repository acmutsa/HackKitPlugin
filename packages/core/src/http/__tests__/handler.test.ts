import { afterEach, expect, it, vi } from "vitest";
import { RequestContext } from "@mikro-orm/core";
import { z } from "zod";
import { createTestHackkit } from "../../testing";
import { AuthSession } from "../../mikro/auth-entities";
import { createHackkitClient } from "../client";
import { createHackkitHandler } from "../handler";
import { type HackKitPlugin } from "../../plugins";
import { type RequestRunner } from "../mutation";
import { createMutationFactory } from "../mutation";

const origin = "http://localhost:3000";
afterEach(() => vi.unstubAllGlobals());
async function signup(
	runtime: Awaited<ReturnType<typeof createTestHackkit>>["runtime"],
	name: string,
) {
	const response = await runtime.auth.api.signUpEmail({
		body: {
			name,
			email: `${name}@example.com`,
			password: "a sufficiently long password",
		},
		asResponse: true,
	});
	expect(response.status).toBe(200);
	// Session cookies are sent as Cookie on the following request, not Set-Cookie.
	const cookie = response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
	const session = await runtime.auth.api.getSession({
		headers: new Headers({ cookie }),
	});
	expect(session).not.toBeNull();
	return { cookie, id: session!.user.id };
}

it("publishes the UI operations with authenticated actors, isolated scopes, and the JSON contract", async () => {
	const managers = new Set();
	const plugin = {
		id: "probe",
		endpoints(run: RequestRunner) {
			const post = createMutationFactory(run);
			return {
				empty: post(
					"/probe/empty",
					z.undefined(),
					async () => undefined,
				),
				failure: post("/probe/failure", z.undefined(), async () => {
					throw new Error("private database details");
				}),
				scope: post(
					"/probe/scope",
					z.undefined(),
					async ({ actorAuthId }) => {
						const em = RequestContext.getEntityManager();
						managers.add(em);
						await new Promise((resolve) => setTimeout(resolve, 5));
						expect(RequestContext.getEntityManager()).toBe(em);
						return { actorAuthId };
					},
				),
			};
		},
	} satisfies HackKitPlugin;
	const disabledEndpoints = vi.fn((run: RequestRunner) => ({
		action: createMutationFactory(run)(
			"/disabled/action",
			z.undefined(),
			async () => "disabled",
		),
	}));
	const runtimeTest = await createTestHackkit({
		userDataOptions: { shirtSize: [{ value: "custom", label: "Custom" }] },
		plugins: [
			plugin,
			{ id: "disabled", enabled: false, endpoints: disabledEndpoints },
		],
	});
	const { runtime } = runtimeTest;
	const errors = vi.fn();
	const handler = createHackkitHandler({
		runtime,
		trustedOrigins: [origin],
		onUnexpectedError: errors,
	});
	expect(disabledEndpoints).not.toHaveBeenCalled();
	const [alice, bob] = await Promise.all([
		signup(runtime, "alice"),
		signup(runtime, "bob"),
	]);
	let requests = 0;
	vi.stubGlobal(
		"fetch",
		async (input: string | URL | Request, init?: RequestInit) => {
			requests++;
			return handler(new Request(input, init));
		},
	);
	const client = createHackkitClient({ baseURL: origin + "/api/hackkit" });
	const headers = (cookie: string) => ({ cookie, origin });
	const result = await Promise.all([
		client("@post/users/claim-hack-tag", {
			body: { hackTag: "alice" },
			headers: headers(alice.cookie),
		}),
		client("@post/users/claim-hack-tag", {
			body: { hackTag: "bob" },
			headers: headers(bob.cookie),
		}),
	]);
	expect(result.map((value) => value.data?.id)).toEqual([alice.id, bob.id]);
	expect(result[0]!.data?.createdAt).toEqual(expect.any(String));
	expect(requests).toBe(2);
	const send = (path: string, body?: unknown, cookie = alice.cookie) =>
		handler(
			new Request(origin + "/api/hackkit" + path, {
				method: "POST",
				headers: {
					...headers(cookie),
					...(body === undefined
						? {}
						: { "content-type": "application/json" }),
				},
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
		);
	const anonymous = await send(
		"/users/claim-hack-tag",
		{ hackTag: "anon" },
		"",
	);
	expect(anonymous.status).toBe(401);
	expect(await anonymous.json()).toMatchObject({ code: "UNAUTHORIZED" });
	expect(
		(
			await send("/users/claim-hack-tag", {
				hackTag: "spoof",
				authId: bob.id,
			})
		).status,
	).toBe(400);
	expect(
		(
			await send("/hackers/register", {
				userId: bob.id,
				university: "Test U",
				major: "CS",
				levelOfStudy: "undergraduate",
				hackathonsAttended: 0,
				softwareExperience: "beginner",
			})
		).status,
	).toBe(400);
	expect(
		(
			await send("/roles/create", {
				name: "Forbidden",
				position: 0,
				permissions: [],
			})
		).status,
	).toBe(403);
	expect(
		(await send("/users/claim-hack-tag", { hackTag: "alice" }, bob.cookie))
			.status,
	).toBe(409);
	const completed = await send("/user-data/complete", {
		age: 20,
		gender: "prefer_not_to_answer",
		race: "prefer_not_to_answer",
		ethnicity: "prefer_not_to_answer",
		shirtSize: "custom",
		dietaryRestrictions: ["none"],
		hasAcceptedMLHCodeOfConduct: true,
		hasSharedDataWithMLH: true,
		isEmailable: true,
	});
	expect(completed.status).toBe(200);
	const empty = await send("/probe/empty");
	expect(await empty.json()).toBeNull();
	expect(empty.headers.get("cache-control")).toBe("no-store");
	const emptyStream = new Request(origin + "/api/hackkit/probe/empty", {
		method: "POST",
		headers: headers(alice.cookie),
		body: new Blob([]),
	});
	expect(emptyStream.body).not.toBeNull();
	expect((await handler(emptyStream)).status).toBe(200);
	const failure = await send("/probe/failure");
	expect(failure.status).toBe(500);
	expect(JSON.stringify(await failure.json())).not.toContain(
		"private database",
	);
	expect(errors).toHaveBeenCalledOnce();
	const scopes = await Promise.all([
		send("/probe/scope"),
		send("/probe/scope", undefined, bob.cookie),
	]);
	expect(await scopes[0]!.json()).toEqual({ actorAuthId: alice.id });
	expect(await scopes[1]!.json()).toEqual({ actorAuthId: bob.id });
	expect(managers.size).toBe(2);
	expect((await send("/disabled/action")).status).toBe(404);
	const invalidOrigin = await handler(
		new Request(origin + "/api/hackkit/probe/empty", {
			method: "POST",
			headers: {
				cookie: alice.cookie,
				origin: "https://example.invalid",
			},
		}),
	);
	expect(invalidOrigin.status).toBe(403);
	const invalidMedia = await handler(
		new Request(origin + "/api/hackkit/probe/empty", {
			method: "POST",
			headers: { ...headers(alice.cookie), "content-type": "text/plain" },
			body: "{}",
		}),
	);
	expect(invalidMedia.status).toBe(415);
	await runtime.orm.em
		.fork()
		.nativeUpdate(
			AuthSession,
			{ userId: alice.id },
			{ expiresAt: new Date(0) },
		);
	const expired = await send("/probe/empty");
	expect(expired.status).toBe(401);
	expect(expired.headers.getSetCookie().length).toBeGreaterThan(0);
});

it("returns native fetch failures without retrying mutations", async () => {
	const fetch = vi.fn().mockRejectedValue(new TypeError("offline"));
	vi.stubGlobal("fetch", fetch);
	const result = await createHackkitClient({
		baseURL: origin + "/api/hackkit",
	})("@post/users/claim-hack-tag", { body: { hackTag: "retry" } });
	expect(result).toMatchObject({
		data: null,
		error: { statusText: "Fetch Error", status: 500 },
	});
	expect(fetch).toHaveBeenCalledOnce();
});

// Compiled by the package typecheck. These assertions never send requests.
async function typeContract() {
	const client = createHackkitClient();
	// @ts-expect-error Paths derive from endpoint definitions.
	client("@post/users/missing");
	client("@post/users/claim-hack-tag", {
		// @ts-expect-error Body fields derive from the endpoint schema.
		body: { hackTag: 123 },
	});
	// @ts-expect-error Core clients have no plugin endpoint types by default.
	client("@post/teams/create", { body: { name: "team", tag: "team" } });
	// @ts-expect-error Bodyless endpoints reject object bodies.
	client("@post/rsvp/confirm", { body: {} });
	const result = await client("@post/users/claim-hack-tag", {
		body: { hackTag: "test" },
	});
	if (!result.error) {
		const date: string = result.data.createdAt;
		// @ts-expect-error JSON dates are strings.
		const invalid: Date = result.data.createdAt;
	}
	const post = createMutationFactory(async () => {
		throw new Error("Compile-only factory");
	});
	const endpoints = {
		create: post(
			"/probe/create",
			z.object({ value: z.string() }).strict(),
			async (_, input) => ({ value: input.value, createdAt: new Date() }),
		),
	};
	const withPlugin = createHackkitClient<typeof endpoints>();
	const pluginResult = await withPlugin("@post/probe/create", {
		body: { value: "hello" },
	});
	if (!pluginResult.error) {
		const date: string = pluginResult.data.createdAt;
	}
	withPlugin("@post/probe/create", {
		// @ts-expect-error Plugin input types derive from the endpoint schema.
		body: { value: 123 },
	});
}
