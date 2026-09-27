import { MikroORM } from "@mikro-orm/core";
import { createOrmOptions, type HackKitDriver } from "@hackkit/core";
import { createJiti } from "jiti";
import type { HackkitConfig } from "./config";

const jiti = createJiti(import.meta.url);

/** CLI commands own their connections and always release them. */
export async function withOrm<T>(
	config: HackkitConfig,
	operation: (orm: MikroORM<HackKitDriver>) => Promise<T>,
): Promise<T> {
	const orm = await MikroORM.init({
		...createOrmOptions(config),
		dynamicImportProvider: (id) => jiti.import(id),
	});
	try {
		return await operation(orm);
	} finally {
		await orm.close();
	}
}
