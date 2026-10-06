import {
	createTestHackkit,
	createTestUser,
	type TestHackkit,
} from "@hackkit/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	CorePermission,
	CoreSetting,
	coreModels,
	seedRoles,
	type HackKit,
} from "@hackkit/core";

const redirectMock = vi.hoisted(() =>
	vi.fn((url: string): never => {
		throw new Error(`REDIRECT:${url}`);
	}),
);
const notFoundMock = vi.hoisted(() =>
	vi.fn((): never => {
		throw new Error("NOT_FOUND");
	}),
);

vi.mock("next/navigation", () => ({
	redirect: (url: string) => redirectMock(url),
	notFound: () => notFoundMock(),
}));

import { createPageGuards } from "../page-guards";

async function seedOwner(hackkit: TestHackkit) {
	await seedRoles({
		em: hackkit.em,
		roles: [
			{
				id: "core.owner",
				name: "Owner",
				position: 0,
				permissions: [CorePermission.SuperAdmin],
			},
		],
	});
	await createTestUser(hackkit, {
		authId: "admin-auth",
		email: "admin@example.com",
		name: "Ad Min",
	});
	await hackkit.em.nativeUpdate(
		coreModels.user,
		{ id: "admin-auth" },
		{ roleId: "core.owner", updatedAt: new Date() },
	);
}

async function setSetting(
	hackkit: TestHackkit,
	key: CoreSetting,
	value: boolean,
) {
	await hackkit.settings.set({
		actorAuthId: "admin-auth",
		key,
		value,
	});
}

async function createFixtureUser(
	hackkit: TestHackkit,
	authId: string,
	hackTag?: string,
) {
	await createTestUser(hackkit, {
		authId,
		email: `${authId}@example.com`,
		name: `${authId} User`,
	});
	if (hackTag) {
		await hackkit.users.claimHackTag({
			authId,
			hackTag,
		});
	}
	return (await hackkit.users.getUser(authId))!;
}

async function completeUserData(hackkit: TestHackkit, authId: string) {
	await hackkit.userData.completeUserData({
		authId,
		age: 20,
		gender: "prefer_not_to_answer",
		race: "prefer_not_to_answer",
		ethnicity: "prefer_not_to_answer",
		shirtSize: "m",
		dietaryRestrictions: [],
		hasAcceptedMLHCodeOfConduct: true,
		hasSharedDataWithMLH: true,
		isEmailable: true,
	});
}

async function registerHacker(hackkit: TestHackkit, authId: string) {
	await hackkit.hackers.registerHacker({
		authId,
		university: "Test U",
		major: "CS",
		levelOfStudy: "undergraduate",
		hackathonsAttended: 0,
		softwareExperience: "intermediate",
	});
}

async function seedCompletedUnapprovedHacker(
	hackkit: TestHackkit,
	authId: string,
	hackTag: string,
) {
	await setSetting(hackkit, CoreSetting.RequireApproval, true);
	await createFixtureUser(hackkit, authId, hackTag);
	await completeUserData(hackkit, authId);
	await registerHacker(hackkit, authId);
}

async function seedApprovedParticipant(
	hackkit: TestHackkit,
	authId: string,
	hackTag: string,
) {
	await createFixtureUser(hackkit, authId, hackTag);
	await completeUserData(hackkit, authId);
	await registerHacker(hackkit, authId);
}

function expectRedirect(promise: Promise<unknown>, to: string) {
	return expect(promise).rejects.toThrow(`REDIRECT:${to}`);
}

describe("createPageGuards", () => {
	let hackkit: TestHackkit;

	beforeEach(async () => {
		redirectMock.mockClear();
		notFoundMock.mockClear();
		hackkit = await createTestHackkit();
		await seedOwner(hackkit);
	});

	it("redirects incomplete onboarding to the next step", async () => {
		await createFixtureUser(hackkit, "user-1", "alice");
		const guards = createPageGuards(hackkit, async () => "user-1");

		await expectRedirect(
			guards.requireCompletedOnboarding(),
			"/onboarding/user-data",
		);

		await completeUserData(hackkit, "user-1");
		await expectRedirect(
			guards.requireCompletedOnboarding(),
			"/onboarding/hacker",
		);
	});

	it("redirects unapproved completed users from participant routes", async () => {
		await seedCompletedUnapprovedHacker(hackkit, "user-2", "bob");

		const guards = createPageGuards(hackkit, async () => "user-2");
		await expectRedirect(guards.requireParticipantAccess(), "/i/approval");
	});

	it("allows approved participants through requireParticipantAccess", async () => {
		await seedApprovedParticipant(hackkit, "user-3", "cara");

		const guards = createPageGuards(hackkit, async () => "user-3");
		const state = await guards.requireParticipantAccess();
		expect(state.user.authId).toBe("user-3");
		expect(state.user.isApproved).toBe(true);
		expect(state.hacker.authId).toBe("user-3");
	});

	it("redirects banned users to suspended", async () => {
		await createFixtureUser(hackkit, "user-4", "dan");
		await hackkit.users.banUser({
			actorAuthId: "admin-auth",
			targetAuthId: "user-4",
			reason: "test",
		});

		const guards = createPageGuards(hackkit, async () => "user-4");
		await expectRedirect(guards.requireNotBanned(), "/suspended");
	});

	it("redirects new hackers when registration is closed", async () => {
		await createFixtureUser(hackkit, "user-5", "erin");
		await completeUserData(hackkit, "user-5");
		await setSetting(hackkit, CoreSetting.RegistrationOpen, false);

		const guards = createPageGuards(hackkit, async () => "user-5");
		await expectRedirect(
			guards.requireHackerRegistrationOpenForNewHacker(),
			"/registration-closed",
		);
		await expectRedirect(
			guards.requireCompletedOnboarding(),
			"/registration-closed",
		);
	});

	it("uses runtime-injected getCurrentUser when provided", async () => {
		await seedApprovedParticipant(hackkit, "user-6", "fran");
		const injected = (await hackkit.users.getUser("user-6"))!;

		const getCurrentUser = vi.fn(async () => injected);
		const guards = createPageGuards(hackkit, async () => "user-6", {
			getCurrentUser,
		});

		const user = await guards.requireApprovedUser();
		expect(user.authId).toBe("user-6");
		expect(getCurrentUser).toHaveBeenCalled();
	});

	it("sends finished onboarding users away from onboarding routes", async () => {
		await seedApprovedParticipant(hackkit, "user-7", "gabe");

		const guards = createPageGuards(hackkit, async () => "user-7");
		await expectRedirect(guards.requireOnboardingAccess(), "/dashboard");
	});
});
