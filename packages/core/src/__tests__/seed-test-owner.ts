import type { DatabaseAdapter } from "../database";
import type { HackKit } from "../hackkit";
import { coreModels } from "../models";
import { CorePermission } from "../permissions";

export type TestHackkit = HackKit & {
	database: DatabaseAdapter;
};

export async function seedTestOwner(
	hackkit: TestHackkit,
	authId = "owner-auth",
) {
	await hackkit.database.insert(coreModels.role, {
		id: "core.owner",
		name: "Owner",
		position: 0,
		permissions: [CorePermission.SuperAdmin],
	});
	await hackkit.users.ensureUser({
		authId,
		email: `${authId}@example.com`,
		firstName: "Test",
		lastName: "Owner",
	});
	await hackkit.database.update(
		coreModels.user,
		{ authId },
		{ roleId: "core.owner", updatedAt: new Date() },
	);
	return (await hackkit.roles.getRole("core.owner"))!;
}
