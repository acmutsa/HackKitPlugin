import Link from "next/link";
import { UserDataForm, toUserDataFormDefaultValues } from "@hackkit/ui";
import { auth } from "@/lib/auth";
import { getCurrentHackkitUser, hackkitHeaders } from "@/lib/hackkit-server";
import { appConfig } from "@/lib/app-config";
import { toHackerFormDefaults } from "@/app/onboarding/hacker/hacker-form-defaults";
import { HackerRegistrationClient } from "@/app/onboarding/hacker/hacker-registration-client";

export const dynamic = "force-dynamic";

export default async function RegistrationSettingsPage() {
	const currentUser = await getCurrentHackkitUser();
	const requestHeaders = await hackkitHeaders();
	const [userData, hacker, options] = await Promise.all([
		auth.api.getHackkitUserData({ headers: requestHeaders }),
		auth.api.getHackkitHacker({ headers: requestHeaders }),
		auth.api.getHackkitOptions(),
	]);

	return (
		<main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
			<div className="space-y-2">
				<Link
					href="/settings"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					Back to settings
				</Link>
				<h1 className="text-3xl font-bold tracking-tight">
					Registration Settings
				</h1>
				<p className="text-muted-foreground">
					Update registration details that organizers use for
					logistics and participant review.
				</p>
			</div>

			<UserDataForm
				currentUser={currentUser}
				userDataOptions={options.userDataOptions}
				defaultValues={
					userData ? toUserDataFormDefaultValues(userData) : undefined
				}
				localStorageKey={`web:settings:${currentUser.authId}:user-data`}
				successRedirectTo="/settings/registration"
			/>

			<HackerRegistrationClient
				currentUser={currentUser}
				defaultValues={toHackerFormDefaults(hacker)}
				registrationOptions={appConfig.hackerRegistrationOptions}
				successRedirectTo="/settings"
			/>
		</main>
	);
}
