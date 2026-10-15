import { createClient, type ClientOptions } from "better-call/client";
import type { Endpoint } from "better-call";
import type { createCoreEndpoints } from "./endpoints";

export type CoreEndpoints = ReturnType<typeof createCoreEndpoints>;
export type HttpEndpoints = Record<string, Endpoint>;
export type HackkitClientOptions = Pick<
	ClientOptions,
	"baseURL" | "headers" | "customFetchImpl"
>;

/** Native better-call path inference. Endpoint imports are erased from the browser bundle. */
export function createHackkitClient<TEndpoints extends HttpEndpoints = {}>(
	options: HackkitClientOptions = {},
) {
	const httpOptions = {
		baseURL: "/api/hackkit",
		credentials: "same-origin" as const,
		retry: 0,
		catchAllError: true,
		...options,
	};
	return Object.assign(
		createClient<CoreEndpoints & TEndpoints>(httpOptions),
		{ options },
	);
}
export type HackkitClient = ReturnType<typeof createHackkitClient<{}>>;
export type { ApiResult, ApiError, ApiErrorCode, Wire } from "./http-contract";
