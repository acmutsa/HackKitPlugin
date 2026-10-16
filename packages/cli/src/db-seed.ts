import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { withOrm } from "./orm";
import { seedRoles, type SeedRolesResult } from "@hackkit/core";

import { type HackkitConfig } from "./config";
import { createConfigLogger } from "./logger";
export type DbSeedResult = SeedRolesResult;
export function runDbSeed(config: HackkitConfig): Promise<DbSeedResult> {
	return runPromise(
		Effect.gen(function* () {
			const result = yield* fromResult(
				withOrm(config, (orm) =>
					orm.em.transactional((em) =>
						seedRoles({
							em,
							roles: config.seedRoles ?? [],
						}),
					),
				),
			);
			const logger = createConfigLogger(config);
			for (const roleId of result.insertedRoleIds) {
				logger.log("info", `Seeded role '${roleId}'.`);
			}
			for (const roleId of result.skippedRoleIds) {
				logger.log("info", `Role '${roleId}' already exists; skipped.`);
			}
			if (
				result.insertedRoleIds.length === 0 &&
				result.skippedRoleIds.length === 0
			) {
				logger.log("info", "No seed roles are configured.");
			}
			return result;
		}),
	);
}
