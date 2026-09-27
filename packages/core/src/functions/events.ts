import { serialize } from "@mikro-orm/core";
import type { HackkitRuntimeContext } from "../hackkit-context.js";
import { eventTypeValueSchema } from "../event-types.js";
import { HackKitError, parseInput } from "../errors.js";
import { withDomainLog } from "../domain-log.js";
import { coreModels } from "../models.js";
import { CorePermission, hasPermission } from "../permissions.js";
import {
	createEventSchemaFactory,
	deleteEventSchema,
	getEventSchema,
	listEventScansSchema,
	recordEventScanSchema,
	updateEventSchemaFactory,
} from "../schemas.js";
import type { AuthId, Event, EventScan } from "../types.js";

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

async function canViewHiddenEvents(
	context: EventsApiContext,
	actorAuthId?: AuthId,
): Promise<boolean> {
	if (!actorAuthId) return false;

	const user = await context.getUserOrThrow(actorAuthId);
	if (!user.roleId) return false;

	const role = await context.getRoleOrThrow(user.roleId);
	return hasPermission(role.permissions, CorePermission.EventsView);
}

function filterVisibleEvents(events: Event[], includeHidden: boolean): Event[] {
	if (includeHidden) return events;
	return events.filter((event) => !event.hidden);
}

export function createEventsApi(context: EventsApiContext) {
	const createEventSchema = createEventSchemaFactory(
		eventTypeValueSchema(context.eventTypes),
	);
	const updateEventSchema = updateEventSchemaFactory(
		eventTypeValueSchema(context.eventTypes),
	);

	const { em, now, id, logger, getUserOrThrow, requirePermission } = context;

	async function getEventOrThrow(eventId: string): Promise<Event> {
		const event = await em.findOne(coreModels.event, { id: eventId });
		if (!event) throw new HackKitError("NOT_FOUND", "Event not found.");
		return serialize(event);
	}

	return {
		options: context.eventTypes,

		async listEvents(input?: { actorAuthId?: AuthId }): Promise<Event[]> {
			const events = await em.find(
				coreModels.event,
				{},
				{ orderBy: { startTime: "asc" } },
			);
			const includeHidden = await canViewHiddenEvents(
				context,
				input?.actorAuthId,
			);
			return serialize(filterVisibleEvents(events, includeHidden));
		},

		async getEvent(input: unknown): Promise<Event | null> {
			const parsed = parseInput(getEventSchema, input);
			const event = await getEventOrThrow(parsed.eventId);
			const includeHidden = await canViewHiddenEvents(
				context,
				parsed.actorAuthId,
			);
			if (event.hidden && !includeHidden) return null;
			return event;
		},

		async createEvent(input: unknown): Promise<Event> {
			const parsed = parseInput(createEventSchema, input);
			return withDomainLog(
				logger,
				"events.create",
				{ actorAuthId: parsed.actorAuthId },
				async () => {
					await requirePermission(
						parsed.actorAuthId,
						CorePermission.EventsCreate,
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
						await em.flush();
						return serialize(created);
					}
				},
			);
		},

		async updateEvent(input: unknown): Promise<Event> {
			const parsed = parseInput(updateEventSchema, input);
			return withDomainLog(
				logger,
				"events.update",
				{
					actorAuthId: parsed.actorAuthId,
					eventId: parsed.eventId,
				},
				async () => {
					await requirePermission(
						parsed.actorAuthId,
						CorePermission.EventsUpdate,
					);
					await getEventOrThrow(parsed.eventId);
					const updated = await em.findOne(coreModels.event, {
						id: parsed.eventId,
					});
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
						await em.flush();
					}
					if (!updated)
						throw new HackKitError("NOT_FOUND", "Event not found.");
					return serialize(updated);
				},
			);
		},

		async deleteEvent(input: unknown): Promise<void> {
			const parsed = parseInput(deleteEventSchema, input);
			return withDomainLog(
				logger,
				"events.delete",
				{
					actorAuthId: parsed.actorAuthId,
					eventId: parsed.eventId,
				},
				async () => {
					await requirePermission(
						parsed.actorAuthId,
						CorePermission.EventsDelete,
					);
					const deleted = await em.nativeDelete(coreModels.event, {
						id: parsed.eventId,
					});
					if (deleted === 0)
						throw new HackKitError("NOT_FOUND", "Event not found.");
				},
			);
		},

		async listEventScans(input: unknown): Promise<EventScan[]> {
			const parsed = parseInput(listEventScansSchema, input);
			await requirePermission(
				parsed.actorAuthId,
				CorePermission.EventsScan,
			);
			await getEventOrThrow(parsed.eventId);
			return serialize(
				await em.find(
					coreModels.eventScan,
					{
						eventId: parsed.eventId,
						...(parsed.targetAuthId
							? { authId: parsed.targetAuthId }
							: {}),
					},
					{ orderBy: { scannedAt: "desc" } },
				),
			);
		},

		async recordEventScan(input: unknown): Promise<{
			scan: EventScan;
			priorScans: EventScan[];
			hadPriorScans: boolean;
		}> {
			const parsed = parseInput(recordEventScanSchema, input);
			return withDomainLog(
				logger,
				"events.recordScan",
				{
					actorAuthId: parsed.actorAuthId,
					targetAuthId: parsed.targetAuthId,
					eventId: parsed.eventId,
				},
				async () => {
					await requirePermission(
						parsed.actorAuthId,
						CorePermission.EventsScan,
					);
					await getUserOrThrow(parsed.targetAuthId);
					await getEventOrThrow(parsed.eventId);

					const priorScans = await em.find(
						coreModels.eventScan,
						{
							eventId: parsed.eventId,
							authId: parsed.targetAuthId,
						},
						{ orderBy: { scannedAt: "desc" } },
					);

					const scan = em.create(coreModels.eventScan, {
						id: id(),
						eventId: parsed.eventId,
						authId: parsed.targetAuthId,
						scannedByAuthId: parsed.actorAuthId,
						scannedAt: now(),
					});
					await em.flush();

					return {
						scan: serialize(scan),
						priorScans: serialize(priorScans),
						hadPriorScans: priorScans.length > 0,
					};
				},
			);
		},
	};
}
