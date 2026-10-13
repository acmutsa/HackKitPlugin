import type { Options, EntitySchema } from "@mikro-orm/core";
import type { SqliteDriver } from "@mikro-orm/sqlite";
import type { LibSqlDriver } from "@mikro-orm/libsql";
import type { MySqlDriver } from "@mikro-orm/mysql";
import type { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { createPluginRegistry, type HackKitPlugin } from "../plugins";
import { assertAuthEntitySchema, type HackKitAuthOptions } from "./auth";

export type HackKitDriver =
	| SqliteDriver
	| LibSqlDriver
	| MySqlDriver
	| PostgreSqlDriver;
export type HackKitDatabaseOptions = Omit<
	Partial<Options<HackKitDriver>>,
	"entities" | "entitiesTs"
> & { driver: NonNullable<Options<HackKitDriver>["driver"]> };

export type CreateOrmOptionsInput = {
	database: HackKitDatabaseOptions;
	auth: HackKitAuthOptions;
	plugins?: readonly HackKitPlugin[];
	entities?: readonly EntitySchema[];
};

/** Runtime and application migrations discover exactly the same entity collection. */
export function createOrmOptions(
	options: CreateOrmOptionsInput,
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
