import { AdminUsersTable } from "@hackkit/ui";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
	const users = await auth.api.listHackkitAdminUsers({
		headers: await hackkitHeaders(),
	});

	return (
		<main className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Users</h1>
				<p className="text-muted-foreground">
					Review registrations, approvals, roles, suspensions, and
					check-ins.
				</p>
			</div>
			<AdminUsersTable users={users} exportHref="/api/admin/export" />
		</main>
	);
}
