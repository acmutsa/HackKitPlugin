import { Effect } from "effect";
import { runPromise, fromResult } from "../../effect";
import { z } from "zod";
import {
	adminCancelRsvpSchema,
	adminSetRsvpStatusSchema,
	adminPromoteRsvpSchema,
} from "../../schemas";
import { createMutationFactory, type RequestRunner } from "../mutation";
export function createRsvpEndpoints(run: RequestRunner) {
	const post = createMutationFactory(run);
	return {
		confirmRsvp: post(
			"/rsvp/confirm",
			z.undefined(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.rsvp.confirm({ authId: actorAuthId }),
						),
					),
				),
		),
		cancelRsvp: post(
			"/rsvp/cancel",
			adminCancelRsvpSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.rsvp.cancel({ ...input, actorAuthId }),
						),
					),
				),
		),
		setRsvpStatus: post(
			"/rsvp/set-status",
			adminSetRsvpStatusSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.rsvp.setStatus({ ...input, actorAuthId }),
						),
					),
				),
		),
		promoteRsvp: post(
			"/rsvp/promote",
			adminPromoteRsvpSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.rsvp.promote({ ...input, actorAuthId }),
						),
					),
				),
		),
	};
}
