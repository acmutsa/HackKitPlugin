import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
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
export function getRuntime() {
	return runPromise(Effect.suspend(() => fromResult(host.getRuntime())));
}
export function getCurrentUser() {
	return runPromise(
		Effect.gen(function* () {
			return yield* fromResult(
				(yield* fromResult(getRuntime())).getCurrentUser(),
			);
		}),
	);
}
export function getHackkit() {
	return runPromise(
		Effect.gen(function* () {
			return (yield* fromResult(getRuntime())).hackkit;
		}),
	);
}
export function getPageGuards() {
	return runPromise(
		Effect.gen(function* () {
			return (yield* fromResult(getRuntime())).pageGuards;
		}),
	);
}
export function getCoreRuntime() {
	return host.core;
}
export const handleHackkitRequest = host.handler;
