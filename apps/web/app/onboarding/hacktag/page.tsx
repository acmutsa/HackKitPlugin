import { HackTagForm } from "@hackkit/ui";
import { getCurrentHackkitUser } from "@/lib/hackkit-server";
import { getOnboardingSteps } from "@/lib/onboarding";
import { OnboardingShell } from "../onboarding-shell";

export const dynamic = "force-dynamic";

export default async function HackTagOnboardingPage() {
	const currentUser = await getCurrentHackkitUser();
	const steps = await getOnboardingSteps("/onboarding/hacktag");

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
				localStorageKey={`web:onboarding:${currentUser.authId}:hacktag`}
				successRedirectTo="/onboarding/user-data"
			/>
		</OnboardingShell>
	);
}
