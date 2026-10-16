import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { CoreSetting } from "@hackkit/core";
import { getCurrentUser, getRuntime } from "@/lib/runtime";
import { EventPassShell } from "./event-pass-shell";
export const dynamic = "force-dynamic";
export default function PassPage() {
	return runPromise(
		Effect.gen(function* () {
			const user = yield* fromResult(getCurrentUser());
			const runtime = yield* fromResult(getRuntime());
			const eventPassQrTtlMs = yield* fromResult(
				runtime.getSettingValue(CoreSetting.EventPassQrTtlMs),
			);
			return (
				<main className="min-h-screen px-6 py-10">
					<EventPassShell
						user={user}
						eventPassQrTtlMs={Number(eventPassQrTtlMs)}
					/>
				</main>
			);
		}),
	);
}
