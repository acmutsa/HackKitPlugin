import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
	getCurrentHackkitUser,
	hackkitHeaders,
	requireHackerRegistrationOpenForNewHacker,
} from "@/lib/hackkit-server";
import { appConfig } from "@/lib/app-config";
import { getOnboardingSteps } from "@/lib/onboarding";
import { OnboardingShell } from "../onboarding-shell";
import { HackerRegistrationClient } from "./hacker-registration-client";
import { toHackerFormDefaults } from "./hacker-form-defaults";

export const dynamic = "force-dynamic";

export default async function HackerOnboardingPage() {
	await requireHackerRegistrationOpenForNewHacker();
	const currentUser = await getCurrentHackkitUser();
	if (!currentUser.hackTag) {
		redirect("/onboarding/hacktag");
	}

	const requestHeaders = await hackkitHeaders();
	const userData = await auth.api.getHackkitUserData({
		headers: requestHeaders,
	});
	if (!userData) {
		redirect("/onboarding/user-data");
	}

	const hacker = await auth.api.getHackkitHacker({ headers: requestHeaders });
	const steps = await getOnboardingSteps("/onboarding/hacker");

	return (
		<OnboardingShell
			steps={steps}
			title="Hacker Registration"
			description="Tell us about your school, experience, and optional resume."
		>
			<HackerRegistrationClient
				currentUser={currentUser}
				defaultValues={toHackerFormDefaults(hacker)}
				registrationOptions={appConfig.hackerRegistrationOptions}
			/>
		</OnboardingShell>
	);
}
