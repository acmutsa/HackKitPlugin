import "server-only";

import { resolveHackkitConfig } from "@hackkit/config";
import hackkitConfig from "../hackkit.config";
import { env } from "../env";
import compiledFunctions from "./generated/orm-functions.js";

export const appConfig = resolveHackkitConfig({
	...hackkitConfig,
	database: { ...hackkitConfig.database, compiledFunctions },
});

export function resolveAppBaseUrl(): string {
	return env.appUrl;
}
