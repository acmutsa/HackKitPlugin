import { z } from "zod";
import { deleteEventSchema } from "../../schemas";
import { eventPassQrBody, resolveEventPassTarget } from "./event-pass";
import { createMutationFactory, type RequestRunner } from "../mutation";

const eventBody = z.object({
	title: z.string().min(1).max(255),
	description: z.string().min(1),
	startTime: z.string().datetime({ offset: true }),
	endTime: z.string().datetime({ offset: true }),
	location: z.string().min(1).max(255),
	type: z.string().min(1),
	host: z
		.string()
		.max(255)
		.transform((value) => value.trim() || undefined),
	hidden: z.boolean(),
});

export function createEventEndpoints(run: RequestRunner) {
	const post = createMutationFactory(run);
	return {
		createEvent: post(
			"/events/create",
			eventBody.strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.events.createEvent({
					...input,
					startTime: new Date(input.startTime),
					endTime: new Date(input.endTime),
					actorAuthId,
				}),
		),
		updateEvent: post(
			"/events/update",
			eventBody.extend({ eventId: z.string().min(1) }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.events.updateEvent({
					...input,
					startTime: new Date(input.startTime),
					endTime: new Date(input.endTime),
					actorAuthId,
				}),
		),
		deleteEvent: post(
			"/events/delete",
			deleteEventSchema.omit({ actorAuthId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.events.deleteEvent({ ...input, actorAuthId }),
		),
		recordScan: post(
			"/events/record-scan",
			eventPassQrBody.extend({ eventId: z.string().min(1) }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.events.recordEventScan({
					actorAuthId,
					eventId: input.eventId,
					targetAuthId: await resolveEventPassTarget(
						hackkit,
						input.rawQr,
					),
				}),
		),
	};
}
