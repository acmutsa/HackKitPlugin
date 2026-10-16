import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { getHackkitRuntime } from "@hackkit/next";
import { notFound, redirect } from "next/navigation";
import { type TeamsApi } from "../../src/api";
import { TeamCreateForm } from "../../src/components/team-create-form";
import { TeamDashboard } from "../../src/components/team-dashboard";
export const dynamic = "force-dynamic";
export default function TeamsPage() {
	return runPromise(
		Effect.gen(function* () {
			const runtime = yield* fromResult(getHackkitRuntime());
			if (!runtime.hackkit.isPluginEnabled("teams")) notFound();
			const teams = runtime.hackkit.plugins.teams as TeamsApi;
			const currentUser = yield* fromResult(runtime.getCurrentUser());
			const hacker = yield* fromResult(
				runtime.hackkit.hackers.getHacker(currentUser.id),
			);
			if (!hacker) {
				redirect("/register");
			}
			const team = yield* fromResult(
				teams.getTeamForAuthId(currentUser.id),
			);
			const teamInvites =
				team && team.ownerAuthId === currentUser.id
					? yield* fromResult(
							teams.listTeamInvites({
								actorAuthId: currentUser.id,
								teamId: team.id,
							}),
						)
					: [];
			return (
				<main className="min-h-screen bg-muted/30 px-6 py-10">
					<div className="mx-auto flex max-w-3xl flex-col gap-6">
						<div className="space-y-2">
							<p className="text-sm font-medium text-primary">
								Teams
							</p>
							<h1 className="text-3xl font-bold tracking-tight">
								Your team
							</h1>
							<p className="text-muted-foreground">
								Create or manage your hackathon competition
								team.
							</p>
						</div>

						{team ? (
							<TeamDashboard
								team={team}
								currentUser={currentUser}
								teamInvites={teamInvites}
							/>
						) : (
							<TeamCreateForm />
						)}
					</div>
				</main>
			);
		}),
	);
}
