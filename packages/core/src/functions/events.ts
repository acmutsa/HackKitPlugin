import { decodeInput } from "../effect-schema";
import { promiseApi, type BoundaryError, fromResult } from "../effect";
import { Effect } from "effect";

import { serialize } from "@mikro-orm/core";
import { type HackkitRuntimeContext } from "../hackkit-context";
import { eventTypeValueSchema } from "../event-types";
import { HackKitError } from "../errors";
import { withDomainLogEffect } from "../domain-log";
import { coreModels } from "../models";
import { CorePermission, hasPermission } from "../permissions";
import {
	createEventSchemaFactory,
	deleteEventSchema,
	getEventSchema,
	listEventScansSchema,
	recordEventScanSchema,
	updateEventSchemaFactory,
} from "../schemas";
import { type AuthId, type Event, type EventScan } from "../types";
export type EventsApiContext = Pick<
	HackkitRuntimeContext,
	| "em"
	| "now"
	| "id"
	| "logger"
	| "eventTypes"
	| "getUserOrThrow"
	| "getRoleOrThrow"
	| "requirePermission"
>;
function canViewHiddenEvents(
	context: EventsApiContext,
	actorAuthId?: AuthId,
): Effect.Effect<boolean, BoundaryError> {
	return Effect.gen(function* () {
		if (!actorAuthId) return false;
		const user = yield* fromResult(context.getUserOrThrow(actorAuthId));
		if (!user.roleId) return false;
		const role = yield* fromResult(context.getRoleOrThrow(user.roleId));
		return hasPermission(role.permissions, CorePermission.EventsView);
	});
}
function filterVisibleEvents(events: Event[], includeHidden: boolean): Event[] {
	if (includeHidden) return events;
	return events.filter((event) => !event.hidden);
}
export function createEventsEffects(context: EventsApiContext) {
	const createEventSchema = createEventSchemaFactory(
		eventTypeValueSchema(context.eventTypes),
	);
	const updateEventSchema = updateEventSchemaFactory(
		eventTypeValueSchema(context.eventTypes),
	);
	const { em, now, id, logger, getUserOrThrow, requirePermission } = context;
	function getEventOrThrow(
		eventId: string,
	): Effect.Effect<Event, BoundaryError> {
		return Effect.gen(function* () {
			const event = yield* fromResult(
				em.findOne(coreModels.event, { id: eventId }),
			);
			if (!event)
				return yield* Effect.fail(
					new HackKitError("NOT_FOUND", "Event not found."),
				);
			return serialize(event);
		});
	}
	return {
		options: context.eventTypes,
		listEvents(input?: {
			actorAuthId?: AuthId;
		}): Effect.Effect<Event[], BoundaryError> {
			return Effect.gen(function* () {
				const events = yield* fromResult(
					em.find(
						coreModels.event,
						{},
						{ orderBy: { startTime: "asc" } },
					),
				);
				const includeHidden = yield* canViewHiddenEvents(
					context,
					input?.actorAuthId,
				);
				return serialize(filterVisibleEvents(events, includeHidden));
			});
		},
		getEvent(input: unknown): Effect.Effect<Event | null, BoundaryError> {
			return Effect.gen(function* () {
				const parsed = yield* decodeInput(getEventSchema, input);
				const event = yield* getEventOrThrow(parsed.eventId);
				const includeHidden = yield* canViewHiddenEvents(
					context,
					parsed.actorAuthId,
				);
				if (event.hidden && !includeHidden) return null;
				return event;
			});
		},
		createEvent(input: unknown): Effect.Effect<Event, BoundaryError> {
			return Effect.gen(function* () {
				const parsed = yield* decodeInput(createEventSchema, input);
				return yield* withDomainLogEffect(
					logger,
					"events.create",
					{ actorAuthId: parsed.actorAuthId },
					() =>
						Effect.gen(function* () {
							yield* fromResult(
								requirePermission(
									parsed.actorAuthId,
									CorePermission.EventsCreate,
								),
							);
							const timestamp = now();
							{
								const created = em.create(coreModels.event, {
									id: id(),
									title: parsed.title,
									description: parsed.description,
									startTime: parsed.startTime,
									endTime: parsed.endTime,
									location: parsed.location,
									type: parsed.type,
									host: parsed.host,
									hidden: parsed.hidden,
									createdAt: timestamp,
									updatedAt: timestamp,
								});
								yield* fromResult(em.flush());
								return serialize(created);
							}
						}),
				);
			});
		},
		updateEvent(input: unknown): Effect.Effect<Event, BoundaryError> {
			return Effect.gen(function* () {
				const parsed = yield* decodeInput(updateEventSchema, input);
				return yield* withDomainLogEffect(
					logger,
					"events.update",
					{
						actorAuthId: parsed.actorAuthId,
						eventId: parsed.eventId,
					},
					() =>
						Effect.gen(function* () {
							yield* fromResult(
								requirePermission(
									parsed.actorAuthId,
									CorePermission.EventsUpdate,
								),
							);
							yield* getEventOrThrow(parsed.eventId);
							const updated = yield* fromResult(
								em.findOne(coreModels.event, {
									id: parsed.eventId,
								}),
							);
							if (updated) {
								em.assign(
									updated,
									{
										title: parsed.title,
										description: parsed.description,
										startTime: parsed.startTime,
										endTime: parsed.endTime,
										location: parsed.location,
										type: parsed.type,
										host: parsed.host ?? undefined,
										hidden: parsed.hidden,
										updatedAt: now(),
									},
									{ ignoreUndefined: true },
								);
								yield* fromResult(em.flush());
							}
							if (!updated)
								return yield* Effect.fail(
									new HackKitError(
										"NOT_FOUND",
										"Event not found.",
									),
								);
							return serialize(updated);
						}),
				);
			});
		},
		deleteEvent(input: unknown): Effect.Effect<void, BoundaryError> {
			return Effect.gen(function* () {
				const parsed = yield* decodeInput(deleteEventSchema, input);
				return yield* withDomainLogEffect(
					logger,
					"events.delete",
					{
						actorAuthId: parsed.actorAuthId,
						eventId: parsed.eventId,
					},
					() =>
						Effect.gen(function* () {
							yield* fromResult(
								requirePermission(
									parsed.actorAuthId,
									CorePermission.EventsDelete,
								),
							);
							const deleted = yield* fromResult(
								em.nativeDelete(coreModels.event, {
									id: parsed.eventId,
								}),
							);
							if (deleted === 0)
								return yield* Effect.fail(
									new HackKitError(
										"NOT_FOUND",
										"Event not found.",
									),
								);
						}),
				);
			});
		},
		listEventScans(
			input: unknown,
		): Effect.Effect<EventScan[], BoundaryError> {
			return Effect.gen(function* () {
				const parsed = yield* decodeInput(listEventScansSchema, input);
				yield* fromResult(
					requirePermission(
						parsed.actorAuthId,
						CorePermission.EventsScan,
					),
				);
				yield* getEventOrThrow(parsed.eventId);
				return serialize(
					yield* fromResult(
						em.find(
							coreModels.eventScan,
							{
								eventId: parsed.eventId,
								...(parsed.targetAuthId
									? { authId: parsed.targetAuthId }
									: {}),
							},
							{ orderBy: { scannedAt: "desc" } },
						),
					),
				);
			});
		},
		recordEventScan(input: unknown): Effect.Effect<
			{
				scan: EventScan;
				priorScans: EventScan[];
				hadPriorScans: boolean;
			},
			BoundaryError
		> {
			return Effect.gen(function* () {
				const parsed = yield* decodeInput(recordEventScanSchema, input);
				return yield* withDomainLogEffect(
					logger,
					"events.recordScan",
					{
						actorAuthId: parsed.actorAuthId,
						targetAuthId: parsed.targetAuthId,
						eventId: parsed.eventId,
					},
					() =>
						Effect.gen(function* () {
							yield* fromResult(
								requirePermission(
									parsed.actorAuthId,
									CorePermission.EventsScan,
								),
							);
							yield* fromResult(
								getUserOrThrow(parsed.targetAuthId),
							);
							yield* getEventOrThrow(parsed.eventId);
							const priorScans = yield* fromResult(
								em.find(
									coreModels.eventScan,
									{
										eventId: parsed.eventId,
										authId: parsed.targetAuthId,
									},
									{
										orderBy: {
											scannedAt: "desc",
										},
									},
								),
							);
							const scan = em.create(coreModels.eventScan, {
								id: id(),
								eventId: parsed.eventId,
								authId: parsed.targetAuthId,
								scannedByAuthId: parsed.actorAuthId,
								scannedAt: now(),
							});
							yield* fromResult(em.flush());
							return {
								scan: serialize(scan),
								priorScans: serialize(priorScans),
								hadPriorScans: priorScans.length > 0,
							};
						}),
				);
			});
		},
	};
}
export function createEventsApi(context: EventsApiContext) {
	return promiseApi(createEventsEffects(context));
}
