import { CorePermission, CoreSetting } from "@hackkit/core";
import { HackathonSettingsForm } from "@hackkit/ui";
import { getPageGuards, getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
const registrationSettings = new Set<string>([
	CoreSetting.RegistrationOpen,
	CoreSetting.RequireApproval,
	CoreSetting.MaximumRegistrations,
	CoreSetting.HackathonCapacity,
]);

export default async function AdminSettingsPage() {
	const guards = await getPageGuards();
	const principal = await guards.requirePermission(
		CorePermission.SettingsManage,
	);
	const { hackkit } = await getRuntime();
	const settings = await hackkit.settings.list({
		actorAuthId: principal.user.id,
	});

	return (
		<main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
			<div>
				<h1 className="text-3xl font-bold">Hackathon Settings</h1>
				<p className="text-muted-foreground">
					Manage live hackathon policy settings.
				</p>
			</div>
			<HackathonSettingsForm
				settings={settings.filter((setting) =>
					registrationSettings.has(setting.key),
				)}
			/>
		</main>
	);
}
