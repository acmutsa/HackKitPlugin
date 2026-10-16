import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import type * as React from "react";
import { getPageGuards } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default function ParticipantLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return runPromise(
		Effect.gen(function* () {
			const guards = yield* fromResult(getPageGuards());
			yield* fromResult(guards.requireParticipantAccess());
			return yield* fromResult(children);
		}),
	);
}
