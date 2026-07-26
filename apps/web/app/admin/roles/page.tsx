import { CorePermission } from "@hackkit/core";
import { AdminRolesPanel } from "@hackkit/ui";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
	const roles = await auth.api.listHackkitRoles({
		headers: await hackkitHeaders(),
	});

	return (
		<main className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Roles</h1>
				<p className="text-muted-foreground">
					Manage admin roles and permissions.
				</p>
			</div>
			<AdminRolesPanel
				roles={roles}
				permissions={Object.values(CorePermission)}
			/>
		</main>
	);
}
