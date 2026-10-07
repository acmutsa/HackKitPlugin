import { createTestUser, type TestHackkit } from "../testing";
import { coreModels } from "../models";
import { CorePermission } from "../permissions";
import { seedRoles } from "../seed";

export type { TestHackkit } from "../testing";

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
		name: "Test Owner",
	});
	const owner = await hackkit.em.findOneOrFail(coreModels.user, {
		id: authId,
	});
	owner.roleId = "core.owner";
	await hackkit.em.flush();
	return (await hackkit.roles.getRole("core.owner"))!;
}
