import "server-only";
import type { PublicShellLink } from "@hackkit/ui";
import { appConfig } from "./app-config";

// Route ownership belongs to the application, including custom navigation.
const pluginRoutes: Record<string, string> = {
	"/teams": "teams",
	"/invites": "teams",
	"/discord": "discord",
};

export function getEnabledSiteLinks(links: readonly PublicShellLink[]) {
	return links.filter((link) => {
		const pluginId = pluginRoutes[link.href];
		if (!pluginId) return true;
		return appConfig.plugins.some(
			(plugin) => plugin.id === pluginId && plugin.enabled !== false,
		);
	});
}
