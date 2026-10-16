import { Effect } from "effect";
import { runPromise, fromResult } from "../../effect";
import { z } from "zod";
import { type HackKit } from "../../hackkit";
import { HackKitError } from "../../errors";
import { CorePermission } from "../../permissions";
import { CoreSetting } from "../../settings";
import { resolveEventPassTargetAuthId } from "../event-pass";
import { createMutationFactory, type RequestRunner } from "../mutation";
export const eventPassQrBody = z.object({ rawQr: z.string().min(1) });
/** Resolve QR targets with the configured lifetime for every scan endpoint. */
export function resolveEventPassTarget(hackkit: HackKit, rawQr: string) {
	return runPromise(
		Effect.gen(function* () {
			const ttl = yield* fromResult(
				hackkit.settings.getValue(CoreSetting.EventPassQrTtlMs),
			);
			return resolveEventPassTargetAuthId(rawQr, new Date(), Number(ttl));
		}),
	);
}
export function createEventPassEndpoints(run: RequestRunner) {
	const post = createMutationFactory(run);
	return {
		previewQr: post(
			"/event-pass/preview",
			eventPassQrBody
				.extend({ eventId: z.string().min(1).optional() })
				.strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.gen(function* () {
						yield* fromResult(
							hackkit.accessControl.requirePermission(
								actorAuthId,
								input.eventId
									? CorePermission.EventsScan
									: CorePermission.UsersCheckIn,
							),
						);
						const targetAuthId = yield* fromResult(
							resolveEventPassTarget(hackkit, input.rawQr),
						);
						const user = yield* fromResult(
							hackkit.users.getUser(targetAuthId),
						);
						if (!user)
							return yield* Effect.fail(
								new HackKitError(
									"NOT_FOUND",
									"User not found.",
								),
							);
						const priorScans = input.eventId
							? yield* fromResult(
									hackkit.events.listEventScans({
										actorAuthId,
										eventId: input.eventId,
										targetAuthId,
									}),
								)
							: [];
						return { user, priorScans };
					}),
				),
		),
	};
}
