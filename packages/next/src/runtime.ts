import {
	initializeHackkit,
	HackKitError,
	type HackKit,
	type HackKitRuntime as CoreRuntime,
	type SettingKey,
	type SettingValue,
	type User,
} from "@hackkit/core";
import { resolveHackkitConfig, type HackkitConfig } from "@hackkit/config";
import type { HackKitUIActions } from "@hackkit/ui";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { nextCookies } from "better-auth/next-js";
import { cache } from "react";
import { createHackKitMutations } from "./mutations";
import { createPageGuards, type PageGuards } from "./page-guards";

export type CreateHackkitRuntimeOptions = {
	core: CoreRuntime;
	afterCurrentUser?: (user: User, hackkit: HackKit) => Promise<void>;
};

export type CreateHackkitRuntimeFromConfigOptions = {
	config: HackkitConfig;
	afterCurrentUser?: CreateHackkitRuntimeOptions["afterCurrentUser"];
};

export type HackkitRuntime = {
	hackkit: HackKit;
	mutations: HackKitUIActions;
	pageGuards: PageGuards;
	getAuthId(): Promise<string>;
	getCurrentUser(): Promise<User>;
	getSettingValue(key: SettingKey): Promise<SettingValue>;
};

export type HackkitRuntimeHost = {
	core: Promise<CoreRuntime>;
	getRuntime(): Promise<HackkitRuntime>;
};

/** Bind domain operations to this request's session and fresh EntityManager. */
export async function createHackkitRuntime(
	options: CreateHackkitRuntimeOptions,
): Promise<HackkitRuntime> {
	const session = await options.core.auth.api.getSession({
		headers: await headers(),
	});
	const { hackkit } = options.core.createScope(session?.user.id);

	async function getAuthId(): Promise<string> {
		if (!session) redirect("/sign-in");
		return session.user.id;
	}

	async function getCurrentUser(): Promise<User> {
		const user = await hackkit.users.getUser(await getAuthId());
		if (!user)
			throw new HackKitError("NOT_FOUND", "User profile not found.");
		await options.afterCurrentUser?.(user, hackkit);
		return user;
	}

	function getSettingValue(key: SettingKey) {
		return hackkit.settings.getValue(key);
	}
	const mutations = createHackKitMutations({
		hackkit,
		getAuthId,
		getSettingValue,
	});
	const pageGuards = createPageGuards(hackkit, getAuthId, {
		getCurrentUser,
		getSettingValue,
	});
	return {
		hackkit,
		mutations,
		pageGuards,
		getAuthId,
		getCurrentUser,
		getSettingValue,
	};
}

/** Initialize shared resources once; React caches only within a server render. */
export function createHackkitRuntimeFromConfig(
	options: CreateHackkitRuntimeFromConfigOptions,
): HackkitRuntimeHost {
	const config = resolveHackkitConfig(options.config);
	const core = initializeHackkit({
		...config,
		auth: {
			...config.auth,
			plugins: [...(config.auth.plugins ?? []), nextCookies()],
		},
	});
	const getRuntime = cache(async () =>
		createHackkitRuntime({
			core: await core,
			afterCurrentUser: options.afterCurrentUser,
		}),
	);
	return { core, getRuntime };
}

let runtimeProvider: (() => Promise<HackkitRuntime>) | undefined;

/** Register a factory, never a request's runtime or EntityManager. */
export function setHackkitRuntime(
	provider: () => Promise<HackkitRuntime>,
): void {
	runtimeProvider = provider;
}

export async function getHackkitRuntime(): Promise<HackkitRuntime> {
	if (!runtimeProvider)
		throw new Error(
			"HackKit runtime is not initialized. Call setHackkitRuntime() from your app runtime module.",
		);
	return runtimeProvider();
}
