import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { z } from "zod";
import {
	createPluginMutationFactory,
	type RequestRunner,
} from "@hackkit/core/http";
import { createDiscordApi } from "./api";
export function createDiscordEndpoints(run: RequestRunner) {
	const post = createPluginMutationFactory(run, {
		id: "discord",
		setup: createDiscordApi,
	});
	return {
		confirm_verification: post(
			"/discord/confirm-verification",
			z.object({ code: z.string().min(1) }).strict(),
			({ api, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							api.confirmVerification({
								...input,
								authId: actorAuthId,
							}),
						),
					),
				),
		),
		sync_member_roles: post(
			"/discord/sync-member-roles",
			z.undefined(),
			({ api, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							api.syncMemberRoles({ authId: actorAuthId }),
						),
					),
				),
		),
	};
}
