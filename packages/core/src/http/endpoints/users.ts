import { Effect } from "effect";
import { runPromise, fromResult } from "../../effect";
import {
	claimHackTagSchema,
	updateUserProfileSchema,
	clearCheckInUserSchema,
	approveUserSchema,
	banUserSchema,
	unbanUserSchema,
} from "../../schemas";
import { eventPassQrBody, resolveEventPassTarget } from "./event-pass";
import { createMutationFactory, type RequestRunner } from "../mutation";
export function createUserEndpoints(run: RequestRunner) {
	const post = createMutationFactory(run);
	return {
		claimHackTag: post(
			"/users/claim-hack-tag",
			claimHackTagSchema.omit({ authId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.users.claimHackTag({
								...input,
								authId: actorAuthId,
							}),
						),
					),
				),
		),
		updateProfile: post(
			"/users/update-profile",
			updateUserProfileSchema.omit({ authId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.users.updateProfile({
								...input,
								authId: actorAuthId,
							}),
						),
					),
				),
		),
		checkIn: post(
			"/users/check-in",
			eventPassQrBody.strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.gen(function* () {
						return yield* fromResult(
							hackkit.users.checkIn({
								actorAuthId,
								targetAuthId: yield* fromResult(
									resolveEventPassTarget(
										hackkit,
										input.rawQr,
									),
								),
							}),
						);
					}),
				),
		),
		clearCheckIn: post(
			"/users/clear-check-in",
			clearCheckInUserSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.users.clearCheckIn({
								...input,
								actorAuthId,
							}),
						),
					),
				),
		),
		approveUser: post(
			"/users/approve",
			approveUserSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.users.approveUser({
								...input,
								actorAuthId,
							}),
						),
					),
				),
		),
		banUser: post(
			"/users/ban",
			banUserSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.users.banUser({ ...input, actorAuthId }),
						),
					),
				),
		),
		unbanUser: post(
			"/users/unban",
			unbanUserSchema.omit({ actorAuthId: true }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.users.unbanUser({ ...input, actorAuthId }),
						),
					),
				),
		),
	};
}
