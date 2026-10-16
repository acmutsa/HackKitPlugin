import { MikroORM } from "@mikro-orm/core";
import { createOrmOptions, type HackKitDriver } from "@hackkit/core";
import {
	operation,
	runPromise,
	type BoundaryError,
} from "@hackkit/core/effect";
import { Effect } from "effect";
import { createJiti } from "jiti";
import { type HackkitConfig } from "./config";

const jiti = createJiti(import.meta.url);

/** CLI commands own their connections and release them on every exit. */
export function withOrmEffect<T>(
	config: HackkitConfig,
	run: (
		orm: MikroORM<HackKitDriver>,
	) => Effect.Effect<T, BoundaryError> | Promise<T>,
): Effect.Effect<T, BoundaryError> {
	return Effect.acquireUseRelease(
		operation(() =>
			MikroORM.init({
				...createOrmOptions(config),
				dynamicImportProvider: (id) => jiti.import(id),
			}),
		),
		(orm) => operation(() => run(orm)),
		(orm) => operation(() => orm.close()).pipe(Effect.orDie),
	).pipe(Effect.uninterruptible);
}

export function withOrm<T>(
	config: HackkitConfig,
	run: (orm: MikroORM<HackKitDriver>) => Promise<T>,
): Promise<T> {
	return runPromise(withOrmEffect(config, run));
}
