import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";
import { respondToInvite } from "@/app/hackkit-plugin-actions";
import { TeamInvites } from "../../src/components/team-invites";
import type { PendingTeamInvite } from "../../src/api";

export const dynamic = "force-dynamic";

export default async function InvitesPage() {
	const requestHeaders = await hackkitHeaders();
	const [hacker, rawInvites] = await Promise.all([
		auth.api.getHackkitHacker({ headers: requestHeaders }),
		auth.api.listPendingHackkitTeamInvites({ headers: requestHeaders }),
	]);
	const invites = rawInvites as unknown as PendingTeamInvite[];

	if (!hacker && invites.length === 0) {
		redirect("/register");
	}

	return (
		<main className="min-h-screen bg-muted/30 px-6 py-10">
			<div className="mx-auto flex max-w-3xl flex-col gap-6">
				<div className="space-y-2">
					<p className="text-sm font-medium text-primary">Teams</p>
					<h1 className="text-3xl font-bold tracking-tight">
						Team invites
					</h1>
					<p className="text-muted-foreground">
						Review and respond to pending team invitations.
					</p>
				</div>

				<TeamInvites
					invites={invites}
					respondToInvite={respondToInvite}
				/>
			</div>
		</main>
	);
}
