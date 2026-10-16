import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { redirect } from "next/navigation";
import { getCurrentUser, getHackkit, getPageGuards } from "@/lib/runtime";
import { appConfig } from "@/lib/app-config";
import { getOnboardingSteps } from "@/lib/onboarding";
import { OnboardingShell } from "../onboarding-shell";
import { HackerRegistrationClient } from "./hacker-registration-client";
import { toHackerFormDefaults } from "./hacker-form-defaults";
export const dynamic = "force-dynamic";
export default function HackerOnboardingPage() {
	return runPromise(
		Effect.gen(function* () {
			yield* fromResult(
				(yield* fromResult(
					getPageGuards(),
				)).requireHackerRegistrationOpenForNewHacker(),
			);
			const currentUser = yield* fromResult(getCurrentUser());
			if (!currentUser.hackTag) {
				redirect("/onboarding/hacktag");
			}
			const hackkit = yield* fromResult(getHackkit());
			const userData = yield* fromResult(
				hackkit.userData.getUserData(currentUser.id),
			);
			if (!userData) {
				redirect("/onboarding/user-data");
			}
			const hacker = yield* fromResult(
				hackkit.hackers.getHacker(currentUser.id),
			);
			const steps = yield* fromResult(
				getOnboardingSteps("/onboarding/hacker"),
			);
			return (
				<OnboardingShell
					steps={steps}
					title="Hacker Registration"
					description="Tell us about your school, experience, and optional resume."
				>
					<HackerRegistrationClient
						currentUser={currentUser}
						defaultValues={toHackerFormDefaults(hacker)}
						registrationOptions={
							appConfig.hackerRegistrationOptions
						}
					/>
				</OnboardingShell>
			);
		}),
	);
}
