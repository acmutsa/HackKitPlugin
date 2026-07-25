import {
	type HackKit,
	type HackKitLogger,
	type HackKitPlugin,
	type LogLevel,
	type User,
} from "@hackkit/core";
import { CorePermission } from "@hackkit/core";
import {
	createHackkit,
	type CreateHackkitOptions,
} from "@hackkit/core/internal";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";

export type BetterAuthUser = {
	id: string;
	email: string;
	name: string;
	image?: string | null;
};

export type HackkitBetterAuthContext = {
	/** The complete framework-independent HackKit API installed by the plugin. */
	api: HackKit;
	/** Resolve and provision the HackKit User represented by Better Auth. */
	getCurrentUser(user: BetterAuthUser): Promise<User>;
};

export type HackkitCallInput = {
	path: string;
	args?: unknown[];
};

export type HackkitCallResult = {
	data: unknown;
};

const hackkitCallSchema = {
	"~standard": {
		version: 1 as const,
		vendor: "hackkit",
		types: {} as {
			input: HackkitCallInput;
			output: Required<HackkitCallInput>;
		},
		validate(value: unknown) {
			if (
				!isRecord(value) ||
				typeof value.path !== "string" ||
				!value.path
			) {
				return {
					issues: [{ message: "HackKit API path is required." }],
				};
			}
			if (value.args !== undefined && !Array.isArray(value.args)) {
				return {
					issues: [{ message: "HackKit API args must be an array." }],
				};
			}
			return {
				value: {
					path: value.path,
					args: value.args ?? [],
				} satisfies Required<HackkitCallInput>,
			};
		},
	},
};

const publicHackkitPaths = new Set([
	"events.getEvent",
	"events.listEvents",
	"groups.listGroups",
	"roles.getRole",
	"roles.listRoles",
	"settings.getValue",
	"users.getPublicProfileByHackTag",
]);

const selfFirstArgumentPaths = new Set([
	"accessControl.getPrincipal",
	"accessControl.hasPermission",
	"accessControl.requirePermission",
	"admin.listRoles",
	"groups.assignNextGroup",
	"groups.getGroupForAuthId",
	"hackers.getHacker",
	"rsvp.getRsvp",
	"userData.getUserData",
	"users.getUser",
	"users.getUserBan",
	"plugins.discord.getMember",
	"plugins.teams.getTeamForAuthId",
	"plugins.teams.listPendingInvites",
]);

const adminOnlyPathPrefixes = ["notifications.", "plugins.notificationsEmail."];
const authenticatedPluginPathPrefixes = ["plugins.discord.", "plugins.teams."];
const adminOnlyPaths = new Set(["plugins.discord.createVerification"]);

export function isPublicHackkitPath(path: string): boolean {
	return publicHackkitPaths.has(path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function bindHackkitCallIdentity(
	path: string,
	args: readonly unknown[],
	authId: string,
): unknown[] {
	if (selfFirstArgumentPaths.has(path)) return [authId, ...args.slice(1)];
	const [first, ...rest] = args;
	if (first === undefined) return [{ authId, actorAuthId: authId }];
	if (!isRecord(first)) return [...args];
	return [{ ...first, authId, actorAuthId: authId }, ...rest];
}

function stripPublicIdentity(args: readonly unknown[]): unknown[] {
	const [first, ...rest] = args;
	if (!isRecord(first)) return [...args];
	const { authId: _authId, actorAuthId: _actorAuthId, ...safe } = first;
	return [safe, ...rest];
}

function requiresAdmin(path: string): boolean {
	if (adminOnlyPaths.has(path)) return true;
	if (adminOnlyPathPrefixes.some((prefix) => path.startsWith(prefix))) {
		return true;
	}
	return (
		path.startsWith("plugins.") &&
		!authenticatedPluginPathPrefixes.some((prefix) =>
			path.startsWith(prefix),
		)
	);
}

function resolveHackkitMethod(api: HackKit, path: string) {
	const segments = path.split(".");
	if (
		segments.length < 2 ||
		segments.some(
			(segment) =>
				!segment ||
				segment === "__proto__" ||
				segment === "prototype" ||
				segment === "constructor",
		)
	) {
		throw new Error(`Invalid HackKit API path '${path}'.`);
	}

	let owner: unknown = api;
	for (const segment of segments.slice(0, -1)) {
		if (!isRecord(owner) || !Object.hasOwn(owner, segment)) {
			throw new Error(`Unknown HackKit API path '${path}'.`);
		}
		owner = owner[segment];
	}
	const methodName = segments.at(-1)!;
	if (!isRecord(owner) || !Object.hasOwn(owner, methodName)) {
		throw new Error(`Unknown HackKit API path '${path}'.`);
	}
	const method = owner[methodName];
	if (typeof method !== "function") {
		throw new Error(`HackKit API path '${path}' is not callable.`);
	}
	return method.bind(owner) as (...args: unknown[]) => unknown;
}

async function invokeHackkit(
	api: HackKit,
	input: HackkitCallInput,
	authId?: string,
) {
	if (!authId && !isPublicHackkitPath(input.path)) {
		throw new Error(
			`HackKit API path '${input.path}' requires authentication.`,
		);
	}
	const args = authId
		? bindHackkitCallIdentity(input.path, input.args ?? [], authId)
		: stripPublicIdentity(input.args ?? []);
	return resolveHackkitMethod(api, input.path)(...args);
}

export type HackkitBetterAuthPluginOptions<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = CreateHackkitOptions<TPlugins>;

function toIdentity(user: BetterAuthUser) {
	const normalizedName = user.name.trim();
	const [firstName = normalizedName || "User", ...lastNameParts] =
		normalizedName.split(/\s+/);

	return {
		authId: user.id,
		email: user.email,
		firstName,
		lastName: lastNameParts.join(" ") || "User",
		profilePhotoUrl: user.image ?? undefined,
	};
}

export function toBetterAuthLogger(logger: HackKitLogger) {
	return {
		disabled: logger.disabled,
		level: logger.level,
		log: (level: LogLevel, message: string, ...args: unknown[]) => {
			logger.log(level, message, ...args);
		},
	};
}

/**
 * Install the complete HackKit domain runtime as a Better Auth plugin.
 *
 * Better Auth owns authentication and request/session lifecycle. HackKit keeps
 * its adapter-neutral domain storage contract so host apps retain ownership of
 * schema generation and migrations.
 */
export function hackkit<const TPlugins extends readonly HackKitPlugin[] = []>(
	options: HackkitBetterAuthPluginOptions<TPlugins>,
) {
	const api = createHackkit(options);
	const context: HackkitBetterAuthContext = {
		api,
		getCurrentUser(user) {
			return api.users.ensureUser(toIdentity(user));
		},
	};

	return {
		id: "hackkit",
		init(_context: Parameters<NonNullable<BetterAuthPlugin["init"]>>[0]) {
			return { context: { hackkit: context } };
		},
		endpoints: {
			getHackkitCurrentUser: createAuthEndpoint(
				"/hackkit/current-user",
				{
					method: "GET",
					use: [sessionMiddleware],
				},
				async (ctx) =>
					ctx.json(
						await context.getCurrentUser(ctx.context.session.user),
					),
			),
			callHackkit: createAuthEndpoint(
				"/hackkit/call",
				{
					method: "POST",
					body: hackkitCallSchema,
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const authId = ctx.context.session.user.id;
					await context.getCurrentUser(ctx.context.session.user);
					if (requiresAdmin(ctx.body.path)) {
						await api.accessControl.requirePermission(
							authId,
							CorePermission.Admin,
						);
					}
					return ctx.json({
						data: await invokeHackkit(api, ctx.body, authId),
					});
				},
			),
			callPublicHackkit: createAuthEndpoint(
				"/hackkit/call-public",
				{
					method: "POST",
					body: hackkitCallSchema,
				},
				async (ctx) =>
					ctx.json({ data: await invokeHackkit(api, ctx.body) }),
			),
		},
		options,
	} satisfies BetterAuthPlugin;
}
