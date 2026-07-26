import { notFound } from "next/navigation";
import { EventAdminForm, toDateTimeLocalValue } from "@hackkit/ui";
import { CorePermission } from "@hackkit/core";
import { auth } from "@/lib/auth";
import { hackkitHeaders, requireHackkitPermission } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
	params,
}: {
	params: { id: string };
}) {
	await requireHackkitPermission(CorePermission.EventsUpdate);
	const requestHeaders = await hackkitHeaders();
	const [event, options] = await Promise.all([
		auth.api.getAnyHackkitEvent({
			headers: requestHeaders,
			body: { eventId: params.id },
		}),
		auth.api.getHackkitOptions(),
	]);

	if (!event) notFound();

	return (
		<main className="min-h-screen px-6 py-10">
			<div className="mx-auto max-w-3xl space-y-6">
				<h1 className="text-3xl font-bold tracking-tight">
					Edit event
				</h1>
				<EventAdminForm
					eventId={event.id}
					eventTypes={options.eventTypes}
					defaultValues={{
						title: event.title,
						description: event.description,
						startTime: toDateTimeLocalValue(event.startTime),
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
}
