import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { CorePermission } from "@hackkit/core";
import { HackathonSettingsForm } from "@hackkit/ui";
import { getPageGuards, getRuntime } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function AdminSettingsPage() {
	return runPromise(
		Effect.gen(function* () {
			const guards = yield* fromResult(getPageGuards());
			const principal = yield* fromResult(
				guards.requirePermission(CorePermission.SettingsManage),
			);
			const { hackkit } = yield* fromResult(getRuntime());
			const settings = yield* fromResult(
				hackkit.settings.list({
					actorAuthId: principal.user.id,
				}),
			);
			return (
				<main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
					<div>
						<h1 className="text-3xl font-bold">
							Hackathon Settings
						</h1>
						<p className="text-muted-foreground">
							Manage live hackathon policy settings.
						</p>
					</div>
					<HackathonSettingsForm settings={settings} />
				</main>
			);
		}),
	);
}
