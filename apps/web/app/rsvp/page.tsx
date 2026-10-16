import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { RsvpConfirmation } from "@hackkit/ui";
import { getRuntime } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function RsvpPage() {
	return runPromise(
		Effect.gen(function* () {
			const runtime = yield* fromResult(getRuntime());
			const authId = yield* fromResult(runtime.getAuthId());
			const [rsvp, summary] = yield* Effect.all(
				[
					fromResult(runtime.hackkit.rsvp.getRsvp(authId)),
					fromResult(runtime.hackkit.rsvp.getSummary()),
				],
				{ concurrency: "unbounded" },
			);
			return (
				<main className="min-h-screen px-6 py-10">
					<RsvpConfirmation rsvp={rsvp} summary={summary} />
				</main>
			);
		}),
	);
}
