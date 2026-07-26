import { CoreSetting } from "@hackkit/core";
import { getCurrentHackkitUser, getHackkitSetting } from "@/lib/hackkit-server";
import { EventPassShell } from "./event-pass-shell";

export const dynamic = "force-dynamic";

export default async function PassPage() {
	const user = await getCurrentHackkitUser();
	const eventPassQrTtlMs = await getHackkitSetting(
		CoreSetting.EventPassQrTtlMs,
	);

	return (
		<main className="min-h-screen px-6 py-10">
			<EventPassShell
				user={user}
				eventPassQrTtlMs={Number(eventPassQrTtlMs)}
			/>
		</main>
	);
}
