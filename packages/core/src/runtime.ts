import { MikroORM, RequestContext, type EntityManager } from "@mikro-orm/core";
import { createLogger } from "./adapters/logger";
import {
	createHackkitFactory,
	type createHackkit,
	type CreateHackkitOptions,
} from "./hackkit";
import {
	createPluginRegistry,
	type HackKitPlugin,
	type HackKitRegistry,
} from "./plugins";
import { createHackKitAuth, type HackKitAuthOptions } from "./mikro/auth";
import {
	createOrmOptions,
	type CreateOrmOptionsInput,
	type HackKitDriver,
} from "./mikro/options";

export type InitializeHackkitOptions<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = Omit<CreateHackkitOptions<TPlugins>, "em" | "registry" | "actorAuthId"> &
	Omit<CreateOrmOptionsInput, "plugins">;

export type HackKitScope<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	em: EntityManager;
	hackkit: ReturnType<typeof createHackkit<TPlugins>>;
};

export type HackKitRuntime<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	orm: MikroORM<HackKitDriver>;
	auth: ReturnType<typeof createHackKitAuth>;
	registry: HackKitRegistry;
	createScope(actorAuthId?: string): HackKitScope<TPlugins>;
	run<T>(
		operation: (scope: HackKitScope<TPlugins>) => Promise<T>,
		actorAuthId?: string,
	): Promise<T>;
};

/** Initialize shared connections and authentication once, then fork per execution. */
export async function initializeHackkit<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(
	options: InitializeHackkitOptions<TPlugins>,
): Promise<HackKitRuntime<TPlugins>> {
	const registry = createPluginRegistry(options.plugins, options.entities);
	const createScopedHackkit = createHackkitFactory<TPlugins>({
		...options,
		registry,
	});
	const orm = await MikroORM.init(createOrmOptions(options));
	let auth: ReturnType<typeof createHackKitAuth>;
	try {
		const logger = createLogger(options.logger);
		auth = createHackKitAuth<HackKitAuthOptions>(orm, {
			...options.auth,
			logger: options.auth.logger ?? {
				disabled: logger.disabled,
				level: logger.level,
				log: (level, message, ...args) =>
					logger.log(level, message, ...args),
			},
		});
	} catch (error) {
		await orm.close();
		throw error;
	}
	function createScope(actorAuthId?: string) {
		const em = orm.em.fork({ useContext: true });
		return {
			em,
			hackkit: createScopedHackkit(em, actorAuthId),
		};
	}
	function run<T>(
		operation: (scope: ReturnType<typeof createScope>) => Promise<T>,
		actorAuthId?: string,
	) {
		return RequestContext.create(orm.em, () => {
			const em = orm.em.getContext();
			return operation({
				em,
				hackkit: createScopedHackkit(em, actorAuthId),
			});
		});
	}
	return { orm, auth, registry, createScope, run };
}
