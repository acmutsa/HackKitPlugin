import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventScanner } from "@hackkit/ui";
import { CorePermission } from "@hackkit/core";
import { getHackkit, getPageGuards } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function EventScannerPage({
	params,
}: {
	params: {
		eventId: string;
	};
}) {
	return runPromise(
		Effect.gen(function* () {
			const pageGuards = yield* fromResult(getPageGuards());
			const principal = yield* fromResult(
				pageGuards.requirePermission(CorePermission.EventsScan),
			);
			const hackkit = yield* fromResult(getHackkit());
			const event = yield* fromResult(
				hackkit.events.getEvent({
					eventId: params.eventId,
					actorAuthId: principal.user.id,
				}),
			);
			if (!event) notFound();
			return (
				<main className="min-h-screen px-6 py-10">
					<div className="mx-auto max-w-3xl space-y-6">
						<div className="flex items-center justify-between gap-4">
							<h1 className="text-2xl font-bold tracking-tight">
								Event scanner
							</h1>
							<Link
								href="/admin/events"
								className="text-sm text-primary hover:underline"
							>
								Back to events
							</Link>
						</div>
						<EventScanner event={event} />
					</div>
				</main>
			);
		}),
	);
}
