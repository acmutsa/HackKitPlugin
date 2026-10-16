import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { UserDataForm, toUserDataFormDefaultValues } from "@hackkit/ui";
import { redirect } from "next/navigation";
import { getCurrentUser, getHackkit } from "@/lib/runtime";
import { getOnboardingSteps } from "@/lib/onboarding";
import { OnboardingShell } from "../onboarding-shell";
export const dynamic = "force-dynamic";
export default function UserDataOnboardingPage() {
	return runPromise(
		Effect.gen(function* () {
			const currentUser = yield* fromResult(getCurrentUser());
			if (!currentUser.hackTag) {
				redirect("/onboarding/hacktag");
			}
			const hackkit = yield* fromResult(getHackkit());
			const existingUserData = yield* fromResult(
				hackkit.userData.getUserData(currentUser.id),
			);
			const steps = yield* fromResult(
				getOnboardingSteps("/onboarding/user-data"),
			);
			return (
				<OnboardingShell
					steps={steps}
					title="User Data"
					description="Complete required MLH, demographic, and logistics information."
				>
					<UserDataForm
						currentUser={currentUser}
						userDataOptions={hackkit.userData.options}
						defaultValues={
							existingUserData
								? toUserDataFormDefaultValues(existingUserData)
								: undefined
						}
						localStorageKey={`web:onboarding:${currentUser.id}:user-data`}
						successRedirectTo="/onboarding/hacker"
					/>
				</OnboardingShell>
			);
		}),
	);
}
