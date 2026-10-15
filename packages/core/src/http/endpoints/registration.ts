import {
	createCompleteUserDataSchema,
	resolveUserDataOptions,
} from "../../user-data-options";
import { registerHackerSchema } from "../../schemas";
import { createMutationFactory, type RequestRunner } from "../mutation";

export function createRegistrationEndpoints(
	run: RequestRunner,
	userDataOptions = resolveUserDataOptions(),
) {
	const post = createMutationFactory(run);
	return {
		completeUserData: post(
			"/user-data/complete",
			createCompleteUserDataSchema(userDataOptions)
				.omit({ authId: true })
				.strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.userData.completeUserData({
					...input,
					authId: actorAuthId,
				}),
		),
		registerHacker: post(
			"/hackers/register",
			registerHackerSchema.omit({ userId: true }).strict(),
			async ({ hackkit, actorAuthId }, input) =>
				hackkit.hackers.registerHacker({
					...input,
					userId: actorAuthId,
				}),
		),
	};
}
