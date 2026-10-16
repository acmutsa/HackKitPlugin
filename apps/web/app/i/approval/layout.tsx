import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import type * as React from "react";
import { getPageGuards } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default function ApprovalLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return runPromise(
		Effect.gen(function* () {
			const guards = yield* fromResult(getPageGuards());
			yield* fromResult(guards.requireApprovalPendingAccess());
			return yield* fromResult(children);
		}),
	);
}
