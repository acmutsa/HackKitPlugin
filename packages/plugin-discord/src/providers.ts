import { Effect } from "effect";
import { runPromise, fromResult, boundaryError } from "@hackkit/core/effect";
import { type DiscordRoleSyncProvider } from "./api";
export type DiscordHttpRoleSyncProviderOptions = {
	baseUrl: string;
	internalAuthKey: string;
	endpoint?: string;
};
function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}
export function createDiscordHttpRoleSyncProvider(
	options: DiscordHttpRoleSyncProviderOptions,
): DiscordRoleSyncProvider {
	return {
		syncRoles(input) {
			return runPromise(
				Effect.gen(function* () {
					const url = new URL(
						options.endpoint ?? "/api/discord/sync",
						trimTrailingSlash(options.baseUrl),
					);
					const response = yield* fromResult(
						fetch(url, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${options.internalAuthKey}`,
							},
							body: JSON.stringify(input),
						}),
					);
					if (!response.ok) {
						return yield* Effect.fail(
							boundaryError(
								new Error(
									`Discord role sync failed with ${response.status}.`,
								),
							),
						);
					}
					const body = yield* fromResult(response.json()).pipe(
						Effect.orElseSucceed(() => undefined),
					);
					if (
						body &&
						typeof body === "object" &&
						"success" in body &&
						!body.success
					) {
						return yield* Effect.fail(
							boundaryError(
								new Error(
									"Discord role sync provider returned failure.",
								),
							),
						);
					}
					return body &&
						typeof body === "object" &&
						"externalId" in body
						? { externalId: String(body.externalId) }
						: undefined;
				}),
			);
		},
	};
}
