import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { AdminOverviewPanel } from "@hackkit/ui";
import { getRuntime } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function AdminOverviewPage() {
	return runPromise(
		Effect.gen(function* () {
			const runtime = yield* fromResult(getRuntime());
			const actorAuthId = yield* fromResult(runtime.getAuthId());
			const overview = yield* fromResult(
				runtime.hackkit.admin.getOverview({ actorAuthId }),
			);
			return (
				<main className="space-y-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Admin Overview
						</h1>
						<p className="text-muted-foreground">
							Registration, approval, suspension, and check-in
							summary.
						</p>
					</div>
					<AdminOverviewPanel overview={overview} />
				</main>
			);
		}),
	);
}
