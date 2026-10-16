import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { z } from "zod";
import {
	createPluginMutationFactory,
	type RequestRunner,
} from "@hackkit/core/http";
import { createTeamsApi } from "./api";
export function createTeamsEndpoints(run: RequestRunner) {
	const post = createPluginMutationFactory(run, {
		id: "teams",
		setup: createTeamsApi,
	});
	return {
		create: post(
			"/teams/create",
			z
				.object({ name: z.string().min(1), tag: z.string().min(1) })
				.strict(),
			({ api, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(api.createTeam({ ...input, actorAuthId })),
					),
				),
		),
		invite: post(
			"/teams/invite",
			z
				.object({
					teamId: z.string().min(1),
					hackTag: z.string().min(1),
				})
				.strict(),
			({ api, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(api.inviteToTeam({ ...input, actorAuthId })),
					),
				),
		),
		respond_to_invite: post(
			"/teams/respond-to-invite",
			z
				.object({ inviteId: z.string().min(1), accept: z.boolean() })
				.strict(),
			({ api, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							api.respondToInvite({ ...input, actorAuthId }),
						),
					),
				),
		),
		leave: post(
			"/teams/leave",
			z.undefined(),
			({ api, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(api.leaveTeam({ actorAuthId })),
					),
				),
		),
		remove_member: post(
			"/teams/remove-member",
			z.object({ memberAuthId: z.string().min(1) }).strict(),
			({ api, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(api.removeMember({ ...input, actorAuthId })),
					),
				),
		),
	};
}
