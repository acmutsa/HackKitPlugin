import type {
	BetterAuthUser,
	HackkitBetterAuthContext,
	HackkitCallResult,
} from "@hackkit/auth-better-auth";
import { isPublicHackkitPath } from "@hackkit/auth-better-auth";
import type { HackKit, SettingKey, SettingValue, User } from "@hackkit/core";
import type { HackKitUIActions } from "@hackkit/ui";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHackKitMutations } from "./mutations";
import { createPageGuards, type PageGuards } from "./page-guards";

type BetterAuthSession = {
	user: BetterAuthUser;
};

export type BetterAuthWithHackkit = {
	$context: PromiseLike<{ hackkit: HackkitBetterAuthContext }>;
	api: {
		getSession(input: {
			headers: Headers;
		}): Promise<BetterAuthSession | null>;
		getHackkitCurrentUser(input: { headers: Headers }): Promise<User>;
		callHackkit(input: {
			headers: Headers;
			body: { path: string; args: unknown[] };
		}): Promise<HackkitCallResult>;
		callPublicHackkit(input: {
			body: { path: string; args: unknown[] };
		}): Promise<HackkitCallResult>;
	};
};

export type CreateHackkitRuntimeOptions = {
	auth: BetterAuthWithHackkit;
	/**
	 * App-specific work after the Better Auth plugin resolves the current user.
	 * Runs for both `runtime.getCurrentUser` and runtime-owned page guards.
	 */
	afterCurrentUser?: (user: User, hackkit: HackKit) => Promise<void>;
};

export type HackkitRuntime = {
	hackkit: HackKit;
	mutations: HackKitUIActions;
	pageGuards: PageGuards;
	getAuthId: () => Promise<string>;
	getCurrentUser: () => Promise<User>;
	getSettingValue: (key: SettingKey) => Promise<SettingValue>;
	invalidateSettingsCache: () => void;
};

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
	return Boolean(value) && typeof value === "object";
}

function createHackkitApiProxy(
	template: HackKit,
	invoke: (path: string, args: unknown[]) => Promise<unknown>,
): HackKit {
	function wrap(value: unknown, path: string): unknown {
		if (!isObject(value) || Array.isArray(value) || value instanceof Date) {
			return value;
		}
		return new Proxy(value, {
			get(target, property, receiver) {
				const member = Reflect.get(target, property, receiver);
				if (typeof property !== "string") return member;
				const memberPath = path ? `${path}.${property}` : property;
				if (typeof member === "function") {
					return (...args: unknown[]) => invoke(memberPath, args);
				}
				return wrap(member, memberPath);
			},
		});
	}

	return wrap(template, "") as HackKit;
}

/** Build Next.js guards and server actions around HackKit's Better Auth plugin. */
export async function createHackkitRuntime(
	options: CreateHackkitRuntimeOptions,
): Promise<HackkitRuntime> {
	const hackkitContext = (await options.auth.$context).hackkit;
	const hackkit = createHackkitApiProxy(
		hackkitContext.api,
		async (path, args) => {
			const result = isPublicHackkitPath(path)
				? await options.auth.api.callPublicHackkit({
						body: { path, args },
					})
				: await options.auth.api.callHackkit({
						headers: await headers(),
						body: { path, args },
					});
			return result.data;
		},
	);

	async function requireSession() {
		const session = await options.auth.api.getSession({
			headers: await headers(),
		});
		if (!session) redirect("/sign-in");
		return session;
	}

	async function getAuthId(): Promise<string> {
		return (await requireSession()).user.id;
	}

	async function getCurrentUser(): Promise<User> {
		await requireSession();
		const user = await options.auth.api.getHackkitCurrentUser({
			headers: await headers(),
		});
		if (options.afterCurrentUser) {
			await options.afterCurrentUser(user, hackkit);
		}
		return user;
	}

	const settingsCache = new Map<SettingKey, Promise<SettingValue>>();
	function invalidateSettingsCache() {
		settingsCache.clear();
	}
	function getSettingValue(key: SettingKey): Promise<SettingValue> {
		const cached = settingsCache.get(key);
		if (cached) return cached;
		const value = hackkit.settings.getValue(key);
		settingsCache.set(key, value);
		return value;
	}

	const mutations = createHackKitMutations({
		hackkit,
		getAuthId,
		getSettingValue,
		invalidateSettingsCache,
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
		invalidateSettingsCache,
	};
}

let runtimePromise: Promise<HackkitRuntime> | null = null;

export function setHackkitRuntime(promise: Promise<HackkitRuntime>): void {
	runtimePromise = promise;
}

export async function getHackkitRuntime(): Promise<HackkitRuntime> {
	if (!runtimePromise) {
		throw new Error(
			"HackKit runtime is not initialized. Call setHackkitRuntime() with the Better Auth plugin runtime.",
		);
	}
	return runtimePromise;
}
