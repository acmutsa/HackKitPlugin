import { CorePermission } from "@hackkit/core";
import { HackathonSettingsForm } from "@hackkit/ui";
import { auth } from "@/lib/auth";
import { hackkitHeaders, requireHackkitPermission } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
	await requireHackkitPermission(CorePermission.SettingsManage);
	const settings = await auth.api.listHackkitSettings({
		headers: await hackkitHeaders(),
	});

	return (
		<main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
			<div>
				<h1 className="text-3xl font-bold">Hackathon Settings</h1>
				<p className="text-muted-foreground">
					Manage live hackathon policy settings.
				</p>
			</div>
			<HackathonSettingsForm settings={settings} />
		</main>
	);
}
