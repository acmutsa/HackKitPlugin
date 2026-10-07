import "server-only";

import {
	createHackkitRuntimeFromConfig,
	setHackkitRuntime,
} from "@hackkit/next";
import { appConfig } from "./app-config";

const host = createHackkitRuntimeFromConfig({
	config: appConfig,
});

setHackkitRuntime(host.getRuntime);

export async function getRuntime() {
	return host.getRuntime();
}

export async function getCurrentUser() {
	return (await getRuntime()).getCurrentUser();
}

export async function getHackkit() {
	return (await getRuntime()).hackkit;
}

export async function getPageGuards() {
	return (await getRuntime()).pageGuards;
}

export function getCoreRuntime() {
	return host.core;
}
