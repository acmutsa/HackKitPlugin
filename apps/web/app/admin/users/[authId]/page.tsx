import { notFound } from "next/navigation";
import { AdminUserDetail } from "@hackkit/ui";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
	params,
}: {
	params: { authId: string };
}) {
	const requestHeaders = await hackkitHeaders();
	const targetAuthId = decodeURIComponent(params.authId);
	const [record, roles] = await Promise.all([
		auth.api.getHackkitAdminUser({
			headers: requestHeaders,
			body: { targetAuthId },
		}),
		auth.api.listHackkitRoles({ headers: requestHeaders }),
	]);

	if (!record) notFound();

	return (
		<main className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					User Detail
				</h1>
				<p className="text-muted-foreground">
					Account, registration, approval, suspension, and role
					details.
				</p>
			</div>
			<AdminUserDetail record={record} roles={roles} />
		</main>
	);
}
