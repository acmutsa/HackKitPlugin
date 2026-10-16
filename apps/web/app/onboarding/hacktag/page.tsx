import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { HackTagForm } from "@hackkit/ui";
import { getCurrentUser } from "@/lib/runtime";
import { getOnboardingSteps } from "@/lib/onboarding";
import { OnboardingShell } from "../onboarding-shell";
export const dynamic = "force-dynamic";
export default function HackTagOnboardingPage() {
	return runPromise(
		Effect.gen(function* () {
			const currentUser = yield* fromResult(getCurrentUser());
			const steps = yield* fromResult(
				getOnboardingSteps("/onboarding/hacktag"),
			);
			return (
				<OnboardingShell
					steps={steps}
					title="Claim your HackTag"
					description="Pick a public handle before continuing with registration."
				>
					<HackTagForm
						currentUser={currentUser}
						defaultValues={
							currentUser.hackTag
								? { hackTag: currentUser.hackTag }
								: undefined
						}
						localStorageKey={`web:onboarding:${currentUser.id}:hacktag`}
						successRedirectTo="/onboarding/user-data"
					/>
				</OnboardingShell>
			);
		}),
	);
}
