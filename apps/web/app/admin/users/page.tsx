import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { AdminUsersTable } from "@hackkit/ui";
import { getRuntime } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function AdminUsersPage() {
	return runPromise(
		Effect.gen(function* () {
			const runtime = yield* fromResult(getRuntime());
			const actorAuthId = yield* fromResult(runtime.getAuthId());
			const users = yield* fromResult(
				runtime.hackkit.admin.listUsers({ actorAuthId }),
			);
			return (
				<main className="space-y-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Users
						</h1>
						<p className="text-muted-foreground">
							Review registrations, approvals, roles, suspensions,
							and check-ins.
						</p>
					</div>
					<AdminUsersTable
						users={users}
						exportHref="/api/admin/export"
					/>
				</main>
			);
		}),
	);
}
