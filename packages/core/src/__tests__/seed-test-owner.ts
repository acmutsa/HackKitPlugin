import { createTestUser, type TestHackkit } from "../testing.js";
import { coreModels } from "../models.js";
import { CorePermission } from "../permissions.js";
import { seedRoles } from "../seed.js";

export type { TestHackkit } from "../testing.js";

export async function seedTestOwner(
	hackkit: TestHackkit,
	authId = "owner-auth",
) {
	await seedRoles({
		em: hackkit.em,
		roles: [
			{
				id: "core.owner",
				name: "Owner",
				position: 0,
				permissions: [CorePermission.SuperAdmin],
			},
		],
	});
	await createTestUser(hackkit, {
		authId,
		email: `${authId}@example.com`,
		firstName: "Test",
		lastName: "Owner",
	});
	const owner = await hackkit.em.findOneOrFail(coreModels.user, { authId });
	owner.roleId = "core.owner";
	await hackkit.em.flush();
	return (await hackkit.roles.getRole("core.owner"))!;
}
