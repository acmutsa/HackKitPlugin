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
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.rsvp.confirm({ authId: actorAuthId }),
		),
		cancelRsvp: post(
			"/rsvp/cancel",
			adminCancelRsvpSchema.omit({ actorAuthId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.rsvp.cancel({ ...input, actorAuthId }),
		),
		setRsvpStatus: post(
			"/rsvp/set-status",
			adminSetRsvpStatusSchema.omit({ actorAuthId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.rsvp.setStatus({ ...input, actorAuthId }),
		),
		promoteRsvp: post(
			"/rsvp/promote",
			adminPromoteRsvpSchema.omit({ actorAuthId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.rsvp.promote({ ...input, actorAuthId }),
		),
	};
}
