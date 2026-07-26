import type {
	HackKit,
	HackKitLogger,
	HackKitPlugin,
	LogLevel,
	User,
} from "@hackkit/core";
import {
	createHackkit,
	type CreateHackkitOptions,
} from "@hackkit/core/internal";
import type { BetterAuthPlugin } from "better-auth";
import { createBetterAuthDatabase } from "./database";
import {
	createHackkitEndpoints,
	selectInstalledHackkitEndpoints,
} from "./endpoints";
import { createHackkitBetterAuthSchema } from "./schema";

export type BetterAuthUser = {
	id: string;
	email: string;
	name: string;
	image?: string | null;
};

export type HackkitBetterAuthPluginOptions<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = Omit<CreateHackkitOptions<TPlugins>, "database">;

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
 * Native Better Auth implementation of HackKit.
 *
 * Better Auth owns the database adapter, user identity, sessions, schema,
 * endpoint lifecycle, and inferred client interface. The domain object exists
 * only inside the plugin implementation and is never exposed as a runtime seam.
 */
export function hackkit<const TPlugins extends readonly HackKitPlugin[] = []>(
	options: HackkitBetterAuthPluginOptions<TPlugins> = {} as HackkitBetterAuthPluginOptions<TPlugins>,
) {
	let domain: HackKit | undefined;
	const schema = createHackkitBetterAuthSchema(options.plugins);

	function getDomain(): HackKit {
		if (!domain)
			throw new Error("HackKit Better Auth plugin is not initialized.");
		return domain;
	}

	async function getCurrentUser(user: BetterAuthUser): Promise<User> {
		return getDomain().users.ensureUser(toIdentity(user));
	}
	const allEndpoints = createHackkitEndpoints({
		getDomain,
		getCurrentUser,
		getOptions: () => ({
			eventTypes: getDomain().events.options,
			userDataOptions: getDomain().userData.options,
			groups: getDomain().groups.listGroups(),
			settings: getDomain().registry.settings,
		}),
	});
	const endpoints = selectInstalledHackkitEndpoints(
		allEndpoints,
		(options.plugins ?? []) as TPlugins,
	);

	return {
		id: "hackkit",
		schema,
		async init(
			context: Parameters<NonNullable<BetterAuthPlugin["init"]>>[0],
		) {
			const database = createBetterAuthDatabase(context.adapter, {
				now: options.clock,
				id: options.id,
			});
			domain = createHackkit({ ...options, database });
		},
		endpoints,
		options,
	} satisfies BetterAuthPlugin;
}

export { createHackkitBetterAuthSchema } from "./schema";
