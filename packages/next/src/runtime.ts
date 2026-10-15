import {
	initializeHackkit,
	HackKitError,
	type HackKit,
	type HackKitPlugin,
	type HackKitRuntime as CoreRuntime,
	type SettingKey,
	type SettingValue,
	type User,
} from "@hackkit/core";
import { resolveHackkitConfig, type HackkitConfig } from "@hackkit/config";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { nextCookies } from "better-auth/next-js";
import { cache } from "react";
import { createHackkitHandler } from "@hackkit/core/http";
import { createPageGuards, type PageGuards } from "./page-guards";

export type CreateHackkitRuntimeOptions<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	core: CoreRuntime<TPlugins>;
	afterCurrentUser?: (user: User, hackkit: HackKit) => Promise<void>;
};

export type CreateHackkitRuntimeFromConfigOptions<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	config: HackkitConfig<TPlugins>;
	afterCurrentUser?: CreateHackkitRuntimeOptions["afterCurrentUser"];
};

export type HackkitRuntime<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	hackkit: ReturnType<CoreRuntime<TPlugins>["createScope"]>["hackkit"];
	pageGuards: PageGuards;
	getAuthId(): Promise<string>;
	getCurrentUser(): Promise<User>;
	getSettingValue(key: SettingKey): Promise<SettingValue>;
};

export type HackkitRuntimeHost<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	core: Promise<CoreRuntime<TPlugins>>;
	handler(request: Request): Promise<Response>;
	getRuntime(): Promise<HackkitRuntime<TPlugins>>;
};

/** Bind domain operations to this request's session and fresh EntityManager. */
export async function createHackkitRuntime<
	const TPlugins extends readonly HackKitPlugin[],
>(
	options: CreateHackkitRuntimeOptions<TPlugins>,
): Promise<HackkitRuntime<TPlugins>> {
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
	const pageGuards = createPageGuards(hackkit, getAuthId, {
		getCurrentUser,
		getSettingValue,
	});
	return {
		hackkit,
		pageGuards,
		getAuthId,
		getCurrentUser,
		getSettingValue,
	};
}

/** Initialize shared resources once; React caches only within a server render. */
export function createHackkitRuntimeFromConfig<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(
	options: CreateHackkitRuntimeFromConfigOptions<TPlugins>,
): HackkitRuntimeHost<TPlugins> {
	const config = resolveHackkitConfig(options.config);

	const baseURL = config.auth.baseURL;
	if (typeof baseURL !== "string")
		throw new Error(
			"HackKit HTTP requires an explicit auth.baseURL origin.",
		);
	const trustedOrigins = config.auth.trustedOrigins;
	if (trustedOrigins && !Array.isArray(trustedOrigins))
		throw new Error("HackKit HTTP requires a static trustedOrigins list.");
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
	let handler: ReturnType<typeof createHackkitHandler> | undefined;

	return {
		core,
		getRuntime,
		handler: async (request) => {
			const runtime = await core;
			handler ??= createHackkitHandler({
				runtime,
				trustedOrigins: [
					new URL(baseURL).origin,
					...(trustedOrigins ?? []),
				],
				logger: config.logger,
			});
			return handler(request);
		},
	};
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
