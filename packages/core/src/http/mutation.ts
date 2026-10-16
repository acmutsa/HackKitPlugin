import { Effect } from "effect";
import { runPromise, fromResult } from "../effect";
import { createEndpoint, type Endpoint } from "better-call";
import { z } from "zod";
import { HackKitError } from "../errors";
import { toJsonDto } from "./http-contract";
import { type HackKit } from "../hackkit";
export type AuthenticatedScope = {
	hackkit: HackKit;
	actorAuthId: string;
};
export type RequestRunner = <T>(
	request: Request,
	operation: (scope: AuthenticatedScope) => Promise<T>,
) => Promise<T>;
export type EndpointFactory = (run: RequestRunner) => Record<string, Endpoint>;
/** Schemas own browser inputs. The request runner supplies the authenticated actor. */
export function createMutationFactory(run: RequestRunner) {
	return function mutation<
		const TPath extends string,
		TSchema extends z.ZodType<unknown>,
		TOutput,
	>(
		path: TPath,
		body: TSchema,
		operation: (
			scope: AuthenticatedScope,
			input: z.output<TSchema>,
		) => Promise<TOutput>,
	) {
		return createEndpoint(
			path,
			{ method: "POST", body, requireRequest: true },
			(context) =>
				runPromise(
					Effect.gen(function* () {
						return toJsonDto(
							yield* fromResult(
								run(context.request, (scope) =>
									operation(scope, context.body),
								),
							),
						);
					}),
				),
		);
	};
}
/** Connect the dynamic plugin registry to the API type declared by its setup factory. */
export function createPluginMutationFactory<TApi extends object>(
	run: RequestRunner,
	plugin: {
		id: string;
		setup: (...args: never[]) => TApi;
	},
) {
	const post = createMutationFactory(run);
	return function mutation<
		const TPath extends string,
		TSchema extends z.ZodType<unknown>,
		TOutput,
	>(
		path: TPath,
		body: TSchema,
		operation: (
			scope: {
				api: TApi;
				actorAuthId: string;
			},
			input: z.output<TSchema>,
		) => Promise<TOutput>,
	) {
		if (!path.startsWith(`/${plugin.id}/`))
			throw new Error(`Plugin endpoints must use /${plugin.id}/.`);
		return post(path, body, (scope, input) => {
			const api = scope.hackkit.plugins[plugin.id];
			if (!api)
				throw new HackKitError(
					"NOT_FOUND",
					`Plugin '${plugin.id}' is not enabled.`,
				);
			return operation(
				{ api: api as TApi, actorAuthId: scope.actorAuthId },
				input,
			);
		});
	};
}
