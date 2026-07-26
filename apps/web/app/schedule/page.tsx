import { ScheduleList } from "@hackkit/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
	const [events, options] = await Promise.all([
		auth.api.listHackkitEvents(),
		auth.api.getHackkitOptions(),
	]);

	return (
		<main className="min-h-screen px-6 py-10">
			<div className="mx-auto max-w-3xl space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Schedule
					</h1>
					<p className="text-muted-foreground">
						Public agenda for the hackathon.
					</p>
				</div>
				<ScheduleList
					events={events}
					eventTypes={options.eventTypes}
					getEventHref={(event) => `/schedule/${event.id}`}
				/>
			</div>
		</main>
	);
}
