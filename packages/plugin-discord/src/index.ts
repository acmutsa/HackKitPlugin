import type { HackKitPlugin } from "@hackkit/core";
import { createDiscordApi, type DiscordPluginOptions } from "./api";
import { discordModels } from "./models";

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

export { createDiscordApi } from "./api";
export { discordModels } from "./models";
export { createDiscordHttpRoleSyncProvider } from "./providers";
export type {
	ConfirmDiscordVerificationInput,
	DiscordActions,
} from "./actions";
export type {
	CreateDiscordVerificationInput,
	DiscordApi,
	DiscordPluginOptions,
	DiscordRoleRef,
	DiscordRoleSyncInput,
	DiscordRoleSyncPlan,
	DiscordRoleSyncProvider,
} from "./api";
export type {
	DiscordMember,
	DiscordRoleSyncAttempt,
	DiscordVerification,
} from "./models";
export type { DiscordHttpRoleSyncProviderOptions } from "./providers";
