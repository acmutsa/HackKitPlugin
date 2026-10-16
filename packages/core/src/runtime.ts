import { Context, Effect, Layer } from "effect";
import {
	operation as effectOperation,
	promiseContext,
	runPromise,
	type BoundaryError,
} from "./effect";
import { MikroORM, RequestContext, type EntityManager } from "@mikro-orm/core";
import { createLogger } from "./adapters/logger";
import { createHackkit, type CreateHackkitOptions } from "./hackkit";
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
export function initializeHackkitEffect<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(
	options: InitializeHackkitOptions<TPlugins>,
): Effect.Effect<HackKitRuntime<TPlugins>, BoundaryError> {
	return Effect.gen(function* () {
		const registry = yield* effectOperation(() =>
			createPluginRegistry(options.plugins, options.entities),
		);
		const orm = yield* effectOperation(() =>
			MikroORM.init(createOrmOptions(options)),
		);
		const auth = yield* effectOperation(() => {
			const logger = createLogger(options.logger);
			return createHackKitAuth<HackKitAuthOptions>(orm, {
				...options.auth,
				logger: options.auth.logger ?? {
					disabled: logger.disabled,
					level: logger.level,
					log: (level, message, ...args) =>
						logger.log(level, message, ...args),
				},
			});
		}).pipe(
			Effect.onError(() =>
				effectOperation(() => orm.close()).pipe(Effect.orDie),
			),
		);

		function createScope(actorAuthId?: string) {
			const em = orm.em.fork({ useContext: true });
			return {
				em,
				hackkit: createHackkit({
					...options,
					em,
					registry,
					actorAuthId,
				}),
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
	}).pipe(Effect.uninterruptible);
}

/** Existing callers retain connection ownership and the Promise contract. */
export function initializeHackkit<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(
	options: InitializeHackkitOptions<TPlugins>,
): Promise<HackKitRuntime<TPlugins>> {
	return runPromise(initializeHackkitEffect(options));
}

export class HackKitRuntimeService extends Context.Tag("@hackkit/core/Runtime")<
	HackKitRuntimeService,
	HackKitRuntime
>() {}

export class HackKitExecution extends Context.Tag("@hackkit/core/Execution")<
	HackKitExecution,
	HackKitScope
>() {}

/** Effect applications release shared connections when their scope closes. */
export function hackkitLayer(options: InitializeHackkitOptions) {
	return Layer.scoped(
		HackKitRuntimeService,
		Effect.acquireRelease(initializeHackkitEffect(options), (runtime) =>
			effectOperation(() => runtime.orm.close()).pipe(Effect.orDie),
		),
	);
}

/** Provide a fresh actor-bound scope within MikroORM's async request context. */
export function runHackkitEffect<T, E>(
	program: Effect.Effect<T, E, HackKitExecution>,
	actorAuthId?: string,
): Effect.Effect<T, E | BoundaryError, HackKitRuntimeService> {
	return Effect.gen(function* () {
		const runtime = yield* HackKitRuntimeService;
		return yield* promiseContext((signal) =>
			runtime.run(
				(scope) =>
					Effect.runPromiseExit(
						program.pipe(
							Effect.provideService(HackKitExecution, scope),
						),
						{ signal },
					),
				actorAuthId,
			),
		);
	});
}
