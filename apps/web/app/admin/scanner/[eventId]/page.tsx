import Link from "next/link";
import { notFound } from "next/navigation";
import { EventScanner } from "@hackkit/ui";
import { CorePermission } from "@hackkit/core";
import { auth } from "@/lib/auth";
import { hackkitHeaders, requireHackkitPermission } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function EventScannerPage({
	params,
}: {
	params: { eventId: string };
}) {
	await requireHackkitPermission(CorePermission.EventsScan);
	const event = await auth.api.getAnyHackkitEvent({
		headers: await hackkitHeaders(),
		body: { eventId: params.eventId },
	});

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
}
