import { Effect } from "effect";
import { runPromise, fromResult } from "../effect";
import { createRouter, APIError, type Endpoint } from "better-call";
import { createLogger, type HackKitLoggerOptions } from "../adapters/logger";
import { HackKitError } from "../errors";
import { type HackKitRuntime } from "../runtime";
import { createCoreEndpoints } from "./endpoints";
import { protectHttpHandler, httpError } from "./http-server";
import { type RequestRunner } from "./mutation";
/** Mount Core and enabled plugins once. Only connections and endpoint definitions are shared. */
export function createHackkitHandler(options: {
	runtime: HackKitRuntime;
	trustedOrigins: readonly string[];
	basePath?: string;
	logger?: HackKitLoggerOptions;
	onUnexpectedError?: (error: unknown) => void;
}) {
	const logger = createLogger(options.logger);
	const onUnexpectedError =
		options.onUnexpectedError ??
		((error) => logger.log("error", "HackKit HTTP request failed.", error));
	const sessionHeaders = new WeakMap<Request, Headers>();
	const run: RequestRunner = (request, operation) =>
		runPromise(
			Effect.gen(function* () {
				const session = yield* fromResult(
					options.runtime.auth.api.getSession({
						headers: request.headers,
						query: { disableCookieCache: true },
						returnHeaders: true,
					}),
				);
				sessionHeaders.set(request, session.headers);
				if (!session.response)
					return yield* Effect.fail(
						new HackKitError(
							"UNAUTHORIZED",
							"Sign in to continue.",
						),
					);
				const actorAuthId = session.response.user.id;
				return yield* fromResult(
					options.runtime.run(
						({ hackkit }) => operation({ hackkit, actorAuthId }),
						actorAuthId,
					),
				);
			}),
		);
	const endpoints: Record<string, Endpoint> = {
		...createCoreEndpoints(
			run,
			options.runtime.createScope().hackkit.userData.options,
		),
	};
	for (const plugin of Object.values(options.runtime.registry.plugins)) {
		if (plugin.enabled === false) continue;
		for (const [name, endpoint] of Object.entries(
			plugin.endpoints?.(run) ?? {},
		)) {
			if (!endpoint.path.startsWith(`/${plugin.id}/`))
				throw new Error(`Plugin endpoints must use /${plugin.id}/.`);
			endpoints[`${plugin.id}.${name}`] = endpoint;
		}
	}
	const paths = new Set<string>();
	for (const endpoint of Object.values(endpoints)) {
		if (endpoint.options.method !== "POST")
			throw new Error("HackKit browser endpoints must use POST.");
		if (paths.has(endpoint.path))
			throw new Error(`Duplicate HTTP route: POST ${endpoint.path}`);
		paths.add(endpoint.path);
	}
	const router = createRouter(endpoints, {
		basePath: options.basePath ?? "/api/hackkit",
		onError(error) {
			if (
				!(error instanceof HackKitError) &&
				!(error instanceof APIError && error.statusCode < 500)
			)
				onUnexpectedError(error);
			return httpError(error);
		},
	});
	return protectHttpHandler(
		(request: Request) =>
			runPromise(
				Effect.gen(function* () {
					const response = yield* fromResult(router.handler(request));
					const headers = sessionHeaders.get(request);
					sessionHeaders.delete(request);
					for (const cookie of headers?.getSetCookie() ?? [])
						response.headers.append("set-cookie", cookie);
					return response;
				}),
			),
		{ ...options, onUnexpectedError },
	);
}
