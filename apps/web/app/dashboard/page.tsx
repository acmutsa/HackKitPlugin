import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import {
	CompetitorOnboardingProgress,
	ParticipantDashboard,
} from "@hackkit/ui";
import { publicSiteConfig } from "@/lib/public-site-config";
import { getEnabledSiteLinks } from "@/lib/plugin-navigation";
import { getHackkit } from "@/lib/runtime";
import {
	getCompetitorOnboardingState,
	getRequireApproval,
} from "@/lib/onboarding";
export const dynamic = "force-dynamic";
export default function DashboardPage() {
	return runPromise(
		Effect.gen(function* () {
			const {
				steps,
				nextHref,
				user: currentUser,
				userData,
				hacker,
			} = yield* fromResult(getCompetitorOnboardingState("/dashboard"));
			const [hackkit, requireApproval] = yield* Effect.all(
				[fromResult(getHackkit()), fromResult(getRequireApproval())],
				{ concurrency: "unbounded" },
			);
			const role = currentUser.roleId
				? yield* fromResult(hackkit.roles.getRole(currentUser.roleId))
				: null;
			const participantName =
				currentUser.name || currentUser.hackTag || "participant";
			return (
				<ParticipantDashboard
					participantName={participantName}
					eventName={publicSiteConfig.event.name}
					roleName={role?.name ?? undefined}
					checkedIn={currentUser.checkedInAt != null}
					requireApproval={requireApproval}
					approved={currentUser.isApproved}
					primaryActions={publicSiteConfig.dashboard.primaryActions}
					resourceLinks={getEnabledSiteLinks(
						publicSiteConfig.dashboard.resourceLinks,
					)}
					statusItems={[
						{
							label: "HackTag",
							value: currentUser.hackTag ?? "Not claimed",
						},
						{
							label: "Profile",
							value: userData ? "Complete" : "Needs information",
						},
						{
							label: "Hacker registration",
							value: hacker ? "Complete" : "Not registered",
						},
					]}
					onboarding={
						nextHref
							? {
									nextHref,
									progress: (
										<CompetitorOnboardingProgress
											steps={steps}
										/>
									),
								}
							: undefined
					}
				/>
			);
		}),
	);
}
