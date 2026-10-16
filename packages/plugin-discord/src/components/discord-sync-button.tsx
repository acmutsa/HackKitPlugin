"use client";

import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, useHackkitClient, showHackkitError } from "@hackkit/ui";
import { type DiscordEndpoints } from "../client";
export function DiscordSyncButton() {
	const client = useHackkitClient<DiscordEndpoints>();
	const router = useRouter();
	const [pending, setPending] = React.useState(false);
	function sync() {
		return runPromise(
			Effect.gen(function* () {
				setPending(true);
				const result = yield* fromResult(
					client("@post/discord/sync-member-roles"),
				);
				setPending(false);
				if (result.error) {
					showHackkitError(result.error);
					return;
				}
				toast.success("Discord roles synced.");
				router.refresh();
			}),
		);
	}
	return (
		<Button disabled={pending} onClick={sync}>
			{pending ? "Syncing..." : "Sync Discord roles"}
		</Button>
	);
}
