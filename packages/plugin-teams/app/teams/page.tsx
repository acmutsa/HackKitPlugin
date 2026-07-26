import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";
import {
	createTeam,
	inviteToTeam,
	leaveTeam,
	removeMember,
} from "@/app/hackkit-plugin-actions";
import { TeamCreateForm } from "../../src/components/team-create-form";
import { TeamDashboard } from "../../src/components/team-dashboard";
import type { TeamInviteWithInvitee, TeamWithMembers } from "../../src/api";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
	const requestHeaders = await hackkitHeaders();
	const [currentUser, hacker, team] = await Promise.all([
		auth.api.getHackkitMe({ headers: requestHeaders }),
		auth.api.getHackkitHacker({ headers: requestHeaders }),
		auth.api.getHackkitTeam({ headers: requestHeaders }),
	]);

	if (!hacker) {
		redirect("/register");
	}

	const currentTeam = team as unknown as TeamWithMembers | null;
	const teamInvites: TeamInviteWithInvitee[] =
		currentTeam && currentTeam.ownerAuthId === currentUser.authId
			? ((await auth.api.listHackkitTeamInvites({
					headers: requestHeaders,
					body: { teamId: currentTeam.id },
				})) as unknown as TeamInviteWithInvitee[])
			: [];

	return (
		<main className="min-h-screen bg-muted/30 px-6 py-10">
			<div className="mx-auto flex max-w-3xl flex-col gap-6">
				<div className="space-y-2">
					<p className="text-sm font-medium text-primary">Teams</p>
					<h1 className="text-3xl font-bold tracking-tight">
						Your team
					</h1>
					<p className="text-muted-foreground">
						Create or manage your hackathon competition team.
					</p>
				</div>

				{currentTeam ? (
					<TeamDashboard
						team={currentTeam}
						currentUser={currentUser}
						teamInvites={teamInvites}
						inviteToTeam={inviteToTeam}
						leaveTeam={leaveTeam}
						removeMember={removeMember}
					/>
				) : (
					<TeamCreateForm createTeam={createTeam} />
				)}
			</div>
		</main>
	);
}
