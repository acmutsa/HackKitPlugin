import { UserDataForm, toUserDataFormDefaultValues } from "@hackkit/ui";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentHackkitUser, hackkitHeaders } from "@/lib/hackkit-server";
import { getOnboardingSteps } from "@/lib/onboarding";
import { OnboardingShell } from "../onboarding-shell";

export const dynamic = "force-dynamic";

export default async function UserDataOnboardingPage() {
	const currentUser = await getCurrentHackkitUser();
	if (!currentUser.hackTag) {
		redirect("/onboarding/hacktag");
	}

	const [existingUserData, options] = await Promise.all([
		auth.api.getHackkitUserData({ headers: await hackkitHeaders() }),
		auth.api.getHackkitOptions(),
	]);
	const steps = await getOnboardingSteps("/onboarding/user-data");

	return (
		<OnboardingShell
			steps={steps}
			title="User Data"
			description="Complete required MLH, demographic, and logistics information."
		>
			<UserDataForm
				currentUser={currentUser}
				userDataOptions={options.userDataOptions}
				defaultValues={
					existingUserData
						? toUserDataFormDefaultValues(existingUserData)
						: undefined
				}
				localStorageKey={`web:onboarding:${currentUser.authId}:user-data`}
				successRedirectTo="/onboarding/hacker"
			/>
		</OnboardingShell>
	);
}
