import "server-only";

import {
	createHackkitRuntimeFromConfig,
	setHackkitRuntime,
} from "@hackkit/next";
import { appConfig } from "./app-config";

import { assertDemoEnvironment } from "../env";

let host:
	| ReturnType<
			typeof createHackkitRuntimeFromConfig<typeof appConfig.plugins>
	  >
	| undefined;
function getHost() {
	assertDemoEnvironment();
	return (host ??= createHackkitRuntimeFromConfig({ config: appConfig }));
}
setHackkitRuntime(async () => getHost().getRuntime());

export async function getRuntime() {
	return getHost().getRuntime();
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
	return getHost().core;
}

export const handleHackkitRequest = (request: Request) =>
	getHost().handler(request);
