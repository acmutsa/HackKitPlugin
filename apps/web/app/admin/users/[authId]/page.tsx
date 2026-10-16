import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { notFound } from "next/navigation";
import { AdminUserDetail } from "@hackkit/ui";
import { getRuntime } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function AdminUserDetailPage({
	params,
}: {
	params: {
		authId: string;
	};
}) {
	return runPromise(
		Effect.gen(function* () {
			const runtime = yield* fromResult(getRuntime());
			const actorAuthId = yield* fromResult(runtime.getAuthId());
			const targetAuthId = decodeURIComponent(params.authId);
			const [record, roles] = yield* Effect.all(
				[
					fromResult(
						runtime.hackkit.admin.getUser({
							actorAuthId,
							targetAuthId,
						}),
					),
					fromResult(
						runtime.hackkit.roles.listRoles({ actorAuthId }),
					),
				],
				{ concurrency: "unbounded" },
			);
			if (!record) notFound();
			return (
				<main className="space-y-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							User Detail
						</h1>
						<p className="text-muted-foreground">
							Account, registration, approval, suspension, and
							role details.
						</p>
					</div>
					<AdminUserDetail record={record} roles={roles} />
				</main>
			);
		}),
	);
}
