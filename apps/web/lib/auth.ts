import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import "server-only";
import { headers } from "next/headers";
import { getCoreRuntime } from "./runtime";
export function getAuth() {
	return runPromise(
		Effect.gen(function* () {
			return (yield* fromResult(getCoreRuntime())).auth;
		}),
	);
}
export function getAuthSession() {
	return runPromise(
		Effect.gen(function* () {
			return yield* fromResult(
				(yield* fromResult(getAuth())).api.getSession({
					headers: headers(),
				}),
			);
		}),
	);
}
