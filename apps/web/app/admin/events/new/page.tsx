import { EventAdminForm, toDateTimeLocalValue } from "@hackkit/ui";
import { CorePermission } from "@hackkit/core";
import { auth } from "@/lib/auth";
import { requireHackkitPermission } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
	await requireHackkitPermission(CorePermission.EventsCreate);
	const options = await auth.api.getHackkitOptions();

	return (
		<main className="min-h-screen px-6 py-10">
			<div className="mx-auto max-w-3xl space-y-6">
				<h1 className="text-3xl font-bold tracking-tight">New event</h1>
				<EventAdminForm
					eventTypes={options.eventTypes}
					defaultValues={{
						startTime: toDateTimeLocalValue(new Date()),
						endTime: toDateTimeLocalValue(
							new Date(Date.now() + 60 * 60 * 1000),
						),
					}}
					submitLabel="Create event"
				/>
			</div>
		</main>
	);
}
