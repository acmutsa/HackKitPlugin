import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import Link from "next/link";
import { EventAdminList } from "@hackkit/ui";
import { CorePermission } from "@hackkit/core";
import { getHackkit, getPageGuards } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function AdminEventsPage() {
	return runPromise(
		Effect.gen(function* () {
			const pageGuards = yield* fromResult(getPageGuards());
			const principal = yield* fromResult(
				pageGuards.requirePermission(CorePermission.EventsView),
			);
			const hackkit = yield* fromResult(getHackkit());
			const events = yield* fromResult(
				hackkit.events.listEvents({
					actorAuthId: principal.user.id,
				}),
			);
			return (
				<main className="min-h-screen px-6 py-10">
					<div className="mx-auto max-w-5xl space-y-6">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div>
								<h1 className="text-3xl font-bold tracking-tight">
									Events
								</h1>
								<p className="text-muted-foreground">
									Manage the hackathon schedule.
								</p>
							</div>
							<Link
								href="/admin/events/new"
								className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
							>
								New event
							</Link>
						</div>
						<EventAdminList
							events={events}
							eventTypes={hackkit.events.options}
						/>
					</div>
				</main>
			);
		}),
	);
}
