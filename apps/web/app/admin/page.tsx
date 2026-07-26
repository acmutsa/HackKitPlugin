import { AdminOverviewPanel } from "@hackkit/ui";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
	const overview = await auth.api.getHackkitAdminOverview({
		headers: await hackkitHeaders(),
	});

	return (
		<main className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Admin Overview
				</h1>
				<p className="text-muted-foreground">
					Registration, approval, suspension, and check-in summary.
				</p>
			</div>
			<AdminOverviewPanel overview={overview} />
		</main>
	);
}
