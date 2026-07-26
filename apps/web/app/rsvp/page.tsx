import { RsvpConfirmation } from "@hackkit/ui";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function RsvpPage() {
	const requestHeaders = await hackkitHeaders();
	const [rsvp, summary] = await Promise.all([
		auth.api.getHackkitRsvp({ headers: requestHeaders }),
		auth.api.getHackkitRsvpSummary(),
	]);

	return (
		<main className="min-h-screen px-6 py-10">
			<RsvpConfirmation rsvp={rsvp} summary={summary} />
		</main>
	);
}
