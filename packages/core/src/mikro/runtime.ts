import {
	MikroORM,
	RequestContext,
	type Options,
	type EntitySchema,
	type EntityManager,
} from "@mikro-orm/core";
import { createLogger } from "../adapters/logger.js";
import type { SqliteDriver } from "@mikro-orm/sqlite";
import type { LibSqlDriver } from "@mikro-orm/libsql";
import type { MySqlDriver } from "@mikro-orm/mysql";
import type { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { createHackkit, type CreateHackkitOptions } from "../hackkit.js";
import {
	createPluginRegistry,
	type HackKitPlugin,
	type HackKitRegistry,
} from "../plugins.js";
import {
	assertAuthEntitySchema,
	createHackKitAuth,
	type HackKitAuthOptions,
} from "./auth.js";

export type HackKitDriver =
	| SqliteDriver
	| LibSqlDriver
	| MySqlDriver
	| PostgreSqlDriver;
export type HackKitDatabaseOptions = Omit<
	Partial<Options<HackKitDriver>>,
	"entities" | "entitiesTs"
> & { driver: NonNullable<Options<HackKitDriver>["driver"]> };
export type InitializeHackkitOptions<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = Omit<CreateHackkitOptions<TPlugins>, "em" | "registry" | "actorAuthId"> & {
	database: HackKitDatabaseOptions;
	auth: HackKitAuthOptions;
	entities?: readonly EntitySchema[];
};

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

/** Runtime and CLI migrations discover exactly the same entity collection. */
export function createOrmOptions(
	options: Pick<
		InitializeHackkitOptions,
		"database" | "plugins" | "entities" | "auth"
	>,
): Partial<Options<HackKitDriver>> {
	const registry = createPluginRegistry(options.plugins, options.entities);
	assertAuthEntitySchema(
		registry.entities.map((entity) => entity.meta),
		options.auth,
	);
	return {
		...options.database,
		entities: registry.entities,
		extensions: [
			...new Set([...(options.database.extensions ?? []), Migrator]),
		],
	};
}

/** Initialize shared connections and authentication once, then fork per execution. */
export async function initializeHackkit<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(
	options: InitializeHackkitOptions<TPlugins>,
): Promise<HackKitRuntime<TPlugins>> {
	const registry = createPluginRegistry(options.plugins, options.entities);
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
			hackkit: createHackkit({ ...options, em, registry, actorAuthId }),
		};
	}
	function run<T>(
		operation: (scope: ReturnType<typeof createScope>) => Promise<T>,
		actorAuthId?: string,
	) {
		const scope = createScope(actorAuthId);
		return RequestContext.create(scope.em, () => operation(scope));
	}
	return { orm, auth, registry, createScope, run };
}
