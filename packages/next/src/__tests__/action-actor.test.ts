import { expect, it } from "vitest";
import { CorePermission, coreModels } from "@hackkit/core";
import { createTestHackkit, createTestUser } from "@hackkit/core/testing";
import { createHackKitMutations } from "../mutations";

it("does not let a submitted actor ID grant a caller administrator permissions", async () => {
	const hackkit = await createTestHackkit();
	for (const authId of ["owner", "caller"]) {
		await createTestUser(hackkit, {
			authId,
			email: `${authId}@example.com`,
			firstName: authId,
			lastName: "Test",
		});
	}
	hackkit.em.create(coreModels.role, {
		id: "owner-role",
		name: "Owner",
		position: 0,
		permissions: [CorePermission.SuperAdmin],
	});
	const owner = await hackkit.em.findOneOrFail(coreModels.user, {
		authId: "owner",
	});
	owner.roleId = "owner-role";
	await hackkit.em.flush();
	const mutations = createHackKitMutations({
		hackkit,
		getAuthId: async () => "caller",
		getSettingValue: hackkit.settings.getValue,
	});
	const submitted = {
		actorAuthId: "owner",
		name: "Forged role",
		position: 10,
		permissions: [],
		color: "#ffffff",
	};
	expect(await mutations.createRole(submitted)).toMatchObject({ ok: false });
	expect(
		await hackkit.em.count(coreModels.role, { name: "Forged role" }),
	).toBe(0);
});
