"use client";

import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, useHackkitClient, showHackkitError } from "@hackkit/ui";
import { type TeamsEndpoints } from "../client";
import { type PendingTeamInvite } from "../api";

type TeamInvitesProps = {
	invites: PendingTeamInvite[];
};

export function TeamInvites({ invites }: TeamInvitesProps) {
	const client = useHackkitClient<TeamsEndpoints>();
	const router = useRouter();
	const [pendingId, setPendingId] = React.useState<string | null>(null);

	function handleRespond(inviteId: string, accept: boolean) {
		return runPromise(
			Effect.gen(function* () {
				setPendingId(inviteId);
				const result = yield* fromResult(
					client("@post/teams/respond-to-invite", {
						body: { inviteId, accept },
					}),
				);
				setPendingId(null);
				if (result.error) {
					showHackkitError(result.error);
					return;
				}
				toast.success(accept ? "Invite accepted." : "Invite declined.");
				router.refresh();
			}),
		);
	}

	if (invites.length === 0) {
		return (
			<div className="rounded-lg border bg-card p-6 shadow-sm">
				<p className="text-muted-foreground">
					No pending team invites.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{invites.map((invite) => (
				<div
					key={invite.id}
					className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
				>
					<div>
						<p className="font-medium">{invite.team.name}</p>
						<p className="text-sm text-muted-foreground">
							@{invite.team.tag}
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							disabled={pendingId === invite.id}
							onClick={() => handleRespond(invite.id, true)}
						>
							Accept
						</Button>
						<Button
							variant="outline"
							disabled={pendingId === invite.id}
							onClick={() => handleRespond(invite.id, false)}
						>
							Decline
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}
