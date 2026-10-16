import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { notFound } from "next/navigation";
import { EventAdminForm, toDateTimeLocalValue } from "@hackkit/ui";
import { CorePermission } from "@hackkit/core";
import { getHackkit, getPageGuards } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function EditEventPage({
	params,
}: {
	params: {
		id: string;
	};
}) {
	return runPromise(
		Effect.gen(function* () {
			const pageGuards = yield* fromResult(getPageGuards());
			const principal = yield* fromResult(
				pageGuards.requirePermission(CorePermission.EventsUpdate),
			);
			const hackkit = yield* fromResult(getHackkit());
			const event = yield* fromResult(
				hackkit.events.getEvent({
					eventId: params.id,
					actorAuthId: principal.user.id,
				}),
			);
			if (!event) notFound();
			return (
				<main className="min-h-screen px-6 py-10">
					<div className="mx-auto max-w-3xl space-y-6">
						<h1 className="text-3xl font-bold tracking-tight">
							Edit event
						</h1>
						<EventAdminForm
							eventId={event.id}
							eventTypes={hackkit.events.options}
							defaultValues={{
								title: event.title,
								description: event.description,
								startTime: toDateTimeLocalValue(
									event.startTime,
								),
								endTime: toDateTimeLocalValue(event.endTime),
								location: event.location,
								type: event.type,
								host: event.host ?? "",
								hidden: event.hidden,
							}}
							submitLabel="Save changes"
						/>
					</div>
				</main>
			);
		}),
	);
}
