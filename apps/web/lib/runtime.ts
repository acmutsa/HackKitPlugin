import "server-only";

import { createHackkitRuntime, setHackkitRuntime } from "@hackkit/next";
import { auth } from "./auth";

const runtimePromise = createHackkitRuntime({ auth });

setHackkitRuntime(runtimePromise);

export async function getRuntime() {
	return runtimePromise;
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
