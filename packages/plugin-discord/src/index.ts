import type { HackKitPlugin } from "@hackkit/core";
import { createDiscordApi, type DiscordPluginOptions } from "./api.js";
import { discordModels } from "./models.js";

export function discordPlugin(
	options: DiscordPluginOptions | (() => DiscordPluginOptions),
): HackKitPlugin<"discord", ReturnType<typeof createDiscordApi>> {
	let resolvedOptions: DiscordPluginOptions | undefined;
	return {
		id: "discord",
		packageName: "@hackkit/plugin-discord",
		actionFactory: "createDiscordActions",
		actionNames: ["confirmDiscordVerification", "syncDiscordMemberRoles"],
		entities: Object.values(discordModels),
		setup: (context) => {
			resolvedOptions ??=
				typeof options === "function" ? options() : options;
			return createDiscordApi(context, resolvedOptions);
		},
	};
}

export { createDiscordApi } from "./api.js";
export { discordModels } from "./models.js";
export { createDiscordHttpRoleSyncProvider } from "./providers.js";
export type {
	ConfirmDiscordVerificationInput,
	DiscordActions,
} from "./actions.js";
export type {
	CreateDiscordVerificationInput,
	DiscordApi,
	DiscordPluginOptions,
	DiscordRoleRef,
	DiscordRoleSyncInput,
	DiscordRoleSyncPlan,
	DiscordRoleSyncProvider,
} from "./api.js";
export type {
	DiscordMember,
	DiscordRoleSyncAttempt,
	DiscordVerification,
} from "./models.js";
export type { DiscordHttpRoleSyncProviderOptions } from "./providers.js";
