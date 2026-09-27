import type { HackKitPlugin } from "@hackkit/core";
import { createDiscordApi, type DiscordPluginOptions } from "./api.js";
import { discordModels } from "./models.js";

export function discordPlugin(
	options: DiscordPluginOptions,
): HackKitPlugin<"discord", ReturnType<typeof createDiscordApi>> {
	return {
		id: "discord",
		packageName: "@hackkit/plugin-discord",
		actionFactory: "createDiscordActions",
		actionNames: ["confirmDiscordVerification", "syncDiscordMemberRoles"],
		entities: Object.values(discordModels),
		setup: (context) => createDiscordApi(context, options),
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
