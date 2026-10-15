import {
	assignRoleSchema,
	createRoleSchema,
	updateRoleSchema,
	deleteRoleSchema,
} from "../../schemas";
import { createMutationFactory, type RequestRunner } from "../mutation";

export function createRoleEndpoints(run: RequestRunner) {
	const post = createMutationFactory(run);
	return {
		assignRole: post(
			"/roles/assign",
			assignRoleSchema.omit({ actorAuthId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.roles.assignRoleToUser({ ...input, actorAuthId }),
		),
		createRole: post(
			"/roles/create",
			createRoleSchema.omit({ actorAuthId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.roles.createRole({ ...input, actorAuthId }),
		),
		updateRole: post(
			"/roles/update",
			updateRoleSchema.omit({ actorAuthId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.roles.updateRole({ ...input, actorAuthId }),
		),
		deleteRole: post(
			"/roles/delete",
			deleteRoleSchema.omit({ actorAuthId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.roles.deleteRole({ ...input, actorAuthId }),
		),
	};
}
