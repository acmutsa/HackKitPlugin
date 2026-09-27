import { expect, it, vi } from "vitest";
import { createTestHackkit } from "@hackkit/core/testing";

const requestHeaders = vi.hoisted(() => vi.fn<() => Headers>());
vi.mock("next/headers", () => ({ headers: requestHeaders }));
vi.mock("next/navigation", () => ({
	redirect: (path: string): never => {
		throw new Error(`REDIRECT:${path}`);
	},
}));

import { createHackkitRuntime } from "../runtime";

it("binds concurrent requests to separate users and never overwrites edited profiles", async () => {
	const { runtime: core } = await createTestHackkit();
	const cookies: string[] = [];
	for (const name of ["Alice", "Bob"]) {
		const response = await core.auth.api.signUpEmail({
			body: {
				name,
				email: `${name.toLowerCase()}@example.com`,
				password: "a sufficiently long password",
			},
			asResponse: true,
		});
		expect(response.status).toBe(200);
		cookies.push(response.headers.get("set-cookie")!);
	}
	requestHeaders.mockReturnValueOnce(new Headers({ cookie: cookies[0] }));
	requestHeaders.mockReturnValueOnce(new Headers({ cookie: cookies[1] }));
	const [alice, bob] = await Promise.all([
		createHackkitRuntime({ core }),
		createHackkitRuntime({ core }),
	]);
	const aliceId = await alice.getAuthId();
	const bobId = await bob.getAuthId();
	expect(aliceId).not.toBe(bobId);
	expect(alice.hackkit).not.toBe(bob.hackkit);
	await alice.hackkit.users.updateProfile({
		authId: aliceId,
		firstName: "Alicia",
		bio: "Saved profile",
	});
	expect(await bob.getCurrentUser()).toMatchObject({
		authId: bobId,
		firstName: "Bob",
	});
	requestHeaders.mockReturnValueOnce(new Headers({ cookie: cookies[0] }));
	const nextRequest = await createHackkitRuntime({ core });
	const profile = await nextRequest.getCurrentUser();
	expect(profile).toMatchObject({
		authId: aliceId,
		firstName: "Alicia",
		bio: "Saved profile",
	});
	expect(Object.getPrototypeOf(profile)).toBe(Object.prototype);
	expect(profile).not.toHaveProperty("password");
	expect(profile).not.toHaveProperty("session");
});

it("redirects an anonymous authenticated operation without creating an identity", async () => {
	const { runtime: core } = await createTestHackkit();
	requestHeaders.mockReturnValueOnce(new Headers());
	const request = await createHackkitRuntime({ core });
	await expect(request.getCurrentUser()).rejects.toThrow("REDIRECT:/sign-in");
});
