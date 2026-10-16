import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { CorePermission } from "@hackkit/core";
import { AdminRolesPanel } from "@hackkit/ui";
import { getRuntime } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function AdminRolesPage() {
	return runPromise(
		Effect.gen(function* () {
			const runtime = yield* fromResult(getRuntime());
			const actorAuthId = yield* fromResult(runtime.getAuthId());
			const roles = yield* fromResult(
				runtime.hackkit.roles.listRoles({ actorAuthId }),
			);
			return (
				<main className="space-y-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Roles
						</h1>
						<p className="text-muted-foreground">
							Manage admin roles and permissions.
						</p>
					</div>
					<AdminRolesPanel
						roles={roles}
						permissions={Object.values(CorePermission)}
					/>
				</main>
			);
		}),
	);
}
