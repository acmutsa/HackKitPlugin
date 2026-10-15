import { z } from "zod";
import type { HackKit } from "../../hackkit";
import { HackKitError } from "../../errors";
import { CorePermission } from "../../permissions";
import { CoreSetting } from "../../settings";
import { resolveEventPassTargetAuthId } from "../event-pass";
import { createMutationFactory, type RequestRunner } from "../mutation";

export const eventPassQrBody = z.object({ rawQr: z.string().min(1) });

/** Resolve QR targets with the configured lifetime for every scan endpoint. */
export async function resolveEventPassTarget(hackkit: HackKit, rawQr: string) {
	const ttl = await hackkit.settings.getValue(CoreSetting.EventPassQrTtlMs);
	return resolveEventPassTargetAuthId(rawQr, new Date(), Number(ttl));
}

export function createEventPassEndpoints(run: RequestRunner) {
	const post = createMutationFactory(run);
	return {
		previewQr: post(
			"/event-pass/preview",
			eventPassQrBody
				.extend({ eventId: z.string().min(1).optional() })
				.strict(),
			async ({ hackkit, actorAuthId }, input) => {
				await hackkit.accessControl.requirePermission(
					actorAuthId,
					input.eventId
						? CorePermission.EventsScan
						: CorePermission.UsersCheckIn,
				);
				const targetAuthId = await resolveEventPassTarget(
					hackkit,
					input.rawQr,
				);
				const user = await hackkit.users.getUser(targetAuthId);
				if (!user)
					throw new HackKitError("NOT_FOUND", "User not found.");
				const priorScans = input.eventId
					? await hackkit.events.listEventScans({
							actorAuthId,
							eventId: input.eventId,
							targetAuthId,
						})
					: [];
				return { user, priorScans };
			},
		),
	};
}
