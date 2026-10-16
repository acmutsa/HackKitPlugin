import { Effect } from "effect";
import { runPromise, fromResult } from "../../effect";
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
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.roles.assignRoleToUser({
								...input,
								actorAuthId,
							}),
						),
					),
				),
		),
		createRole: post(
			"/roles/create",
			createRoleSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.roles.createRole({ ...input, actorAuthId }),
						),
					),
				),
		),
		updateRole: post(
			"/roles/update",
			updateRoleSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.roles.updateRole({ ...input, actorAuthId }),
						),
					),
				),
		),
		deleteRole: post(
			"/roles/delete",
			deleteRoleSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.roles.deleteRole({ ...input, actorAuthId }),
						),
					),
				),
		),
	};
}
