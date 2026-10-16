import { decodeInput } from "../effect-schema";
import { promiseApi, type BoundaryError, fromResult } from "../effect";
import { Effect } from "effect";

import { serialize } from "@mikro-orm/core";
import { withOperationLockEffect } from "../mikro/operation";
import { type HackkitRuntimeContext } from "../hackkit-context";
import { CoreNotificationKind } from "../notifications";
import { HackKitError } from "../errors";
import { withDomainLogEffect } from "../domain-log";
import { coreModels } from "../models";
import { CorePermission } from "../permissions";
import {
	adminCancelRsvpSchema,
	adminPromoteRsvpSchema,
	adminSetRsvpStatusSchema,
	confirmRsvpSchema,
} from "../schemas";
import { CoreSetting } from "../settings";
import { type AuthId, type Rsvp } from "../types";
export type RsvpSummary = {
	isOpen: boolean;
	limit: number;
	waitlistEnabled: boolean;
	confirmedCount: number;
	waitlistedCount: number;
	availableSpots: number | null;
};
export type RsvpApiContext = Pick<
	HackkitRuntimeContext,
	| "em"
	| "now"
	| "logger"
	| "getUserOrThrow"
	| "getSettingValue"
	| "requirePermission"
	| "notifications"
>;
function activeRsvps(rsvps: readonly Rsvp[]): Rsvp[] {
	return rsvps.filter((rsvp) => rsvp.status !== "cancelled");
}
function confirmedRsvps(rsvps: readonly Rsvp[]): Rsvp[] {
	return rsvps.filter((rsvp) => rsvp.status === "confirmed");
}
function waitlistedRsvps(rsvps: readonly Rsvp[]): Rsvp[] {
	return rsvps.filter((rsvp) => rsvp.status === "waitlisted");
}
function sortWaitlist(rsvps: readonly Rsvp[]): Rsvp[] {
	return [...waitlistedRsvps(rsvps)].sort((left, right) => {
		const leftPosition = left.waitlistPosition ?? Number.MAX_SAFE_INTEGER;
		const rightPosition = right.waitlistPosition ?? Number.MAX_SAFE_INTEGER;
		if (leftPosition !== rightPosition) return leftPosition - rightPosition;
		return left.createdAt.getTime() - right.createdAt.getTime();
	});
}
export function createRsvpEffects(context: RsvpApiContext) {
	const {
		em,
		now,
		logger,
		getUserOrThrow,
		getSettingValue,
		requirePermission,
	} = context;
	function getSettings() {
		return Effect.gen(function* () {
			const [isOpen, limit, waitlistEnabled] = yield* Effect.all(
				[
					fromResult(getSettingValue(CoreSetting.RsvpOpen)),
					fromResult(getSettingValue(CoreSetting.RsvpLimit)),
					fromResult(
						getSettingValue(CoreSetting.RsvpWaitlistEnabled),
					),
				],
				{ concurrency: "unbounded" },
			);
			return {
				isOpen: Boolean(isOpen),
				limit: Number(limit),
				waitlistEnabled: Boolean(waitlistEnabled),
			};
		});
	}
	function listAll(): Effect.Effect<Rsvp[], BoundaryError> {
		return Effect.gen(function* () {
			return serialize(
				yield* fromResult(
					em.find(
						coreModels.rsvp,
						{},
						{ orderBy: { createdAt: "asc" } },
					),
				),
			);
		});
	}
	function nextWaitlistPosition(): Effect.Effect<number, BoundaryError> {
		return Effect.gen(function* () {
			const waitlist = sortWaitlist(yield* listAll());
			return (
				Math.max(
					0,
					...waitlist.map((rsvp) => rsvp.waitlistPosition ?? 0),
				) + 1
			);
		});
	}
	function assertApprovedHacker(
		authId: AuthId,
	): Effect.Effect<void, BoundaryError> {
		return Effect.gen(function* () {
			const user = yield* fromResult(getUserOrThrow(authId));
			if (!user.isApproved) {
				return yield* Effect.fail(
					new HackKitError(
						"INVALID_OPERATION",
						"Only approved hackers can RSVP.",
					),
				);
			}
			const hacker = yield* fromResult(
				em.findOne(coreModels.hacker, { userId: authId }),
			);
			if (!hacker) {
				return yield* Effect.fail(
					new HackKitError(
						"INVALID_OPERATION",
						"Only registered hackers can RSVP.",
					),
				);
			}
		});
	}
	function queueRsvpIntent(rsvp: Rsvp, promotedByAuthId?: AuthId) {
		return Effect.gen(function* () {
			if (rsvp.status === "confirmed") {
				const wasPromoted = Boolean(promotedByAuthId);
				yield* fromResult(
					context.notifications.queueIntent({
						kind: wasPromoted
							? CoreNotificationKind.RsvpPromoted
							: CoreNotificationKind.RsvpConfirmed,
						recipientAuthId: rsvp.authId,
						payload: { authId: rsvp.authId },
						idempotencyKey: wasPromoted
							? `rsvp:promoted:${rsvp.authId}:${rsvp.promotedAt?.toISOString() ?? ""}`
							: `rsvp:confirmed:${rsvp.authId}`,
					}),
				);
			}
			if (rsvp.status === "waitlisted") {
				yield* fromResult(
					context.notifications.queueIntent({
						kind: CoreNotificationKind.RsvpWaitlisted,
						recipientAuthId: rsvp.authId,
						payload: {
							authId: rsvp.authId,
							position: rsvp.waitlistPosition,
						},
						idempotencyKey: `rsvp:waitlisted:${rsvp.authId}`,
					}),
				);
			}
		});
	}
	function renumberWaitlist(): Effect.Effect<void, BoundaryError> {
		return Effect.gen(function* () {
			const waitlist = sortWaitlist(yield* listAll());
			for (const [index, rsvp] of waitlist.entries()) {
				const position = index + 1;
				if (rsvp.waitlistPosition === position) continue;
				{
					const updatedRows = yield* fromResult(
						em.find(coreModels.rsvp, {
							authId: rsvp.authId,
						}),
					);
					for (const row of updatedRows)
						em.assign(
							row,
							{
								waitlistPosition: position,
								updatedAt: now(),
							},
							{ ignoreUndefined: true },
						);
					yield* fromResult(em.flush());
				}
			}
		});
	}
	function writeRsvp(
		authId: AuthId,
		patch: Partial<Rsvp>,
	): Effect.Effect<Rsvp, BoundaryError> {
		return Effect.gen(function* () {
			const existing = yield* fromResult(
				em.findOne(coreModels.rsvp, { authId }),
			);
			const timestamp = now();
			const value = {
				...patch,
				authId,
				updatedAt: timestamp,
			};
			if (!existing) {
				{
					const created = em.create(coreModels.rsvp, {
						status: "confirmed",
						createdAt: timestamp,
						...value,
					});
					yield* fromResult(em.flush());
					return serialize(created);
				}
			}
			const updated = yield* fromResult(
				em.findOne(coreModels.rsvp, { authId }),
			);
			if (updated) {
				em.assign(updated, value, { ignoreUndefined: true });
				yield* fromResult(em.flush());
			}
			if (!updated)
				return yield* Effect.fail(
					new HackKitError("NOT_FOUND", "RSVP not found."),
				);
			return serialize(updated);
		});
	}
	function getSummary(): Effect.Effect<RsvpSummary, BoundaryError> {
		return Effect.gen(function* () {
			const [{ isOpen, limit, waitlistEnabled }, rsvps] =
				yield* Effect.all([getSettings(), listAll()], {
					concurrency: "unbounded",
				});
			const confirmedCount = confirmedRsvps(rsvps).length;
			const waitlistedCount = waitlistedRsvps(rsvps).length;
			return {
				isOpen,
				limit,
				waitlistEnabled,
				confirmedCount,
				waitlistedCount,
				availableSpots:
					limit === 0 ? null : Math.max(0, limit - confirmedCount),
			};
		});
	}
	return {
		getSummary,
		getRsvp(authId: AuthId): Effect.Effect<Rsvp | null, BoundaryError> {
			return Effect.gen(function* () {
				const record = yield* fromResult(
					em.findOne(coreModels.rsvp, { authId }),
				);
				return record ? serialize(record) : null;
			});
		},
		listRsvps(input?: {
			actorAuthId?: AuthId;
		}): Effect.Effect<Rsvp[], BoundaryError> {
			return Effect.gen(function* () {
				if (input?.actorAuthId) {
					yield* fromResult(
						requirePermission(
							input.actorAuthId,
							CorePermission.UsersView,
						),
					);
				}
				return yield* listAll();
			});
		},
		confirm(input: unknown): Effect.Effect<Rsvp, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "rsvp", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(
							confirmRsvpSchema,
							input,
						);
						return yield* withDomainLogEffect(
							logger,
							"rsvp.confirm",
							{ targetAuthId: parsed.authId },
							() =>
								Effect.gen(function* () {
									yield* assertApprovedHacker(parsed.authId);
									const settings = yield* getSettings();
									if (!settings.isOpen) {
										return yield* Effect.fail(
											new HackKitError(
												"INVALID_OPERATION",
												"RSVPs are closed.",
											),
										);
									}
									const existing = yield* fromResult(
										em.findOne(coreModels.rsvp, {
											authId: parsed.authId,
										}),
									);
									if (
										existing &&
										existing.status !== "cancelled"
									)
										return serialize(existing);
									const active = activeRsvps(
										yield* listAll(),
									);
									const confirmedCount =
										confirmedRsvps(active).length;
									const timestamp = now();
									const hasCapacity =
										settings.limit === 0 ||
										confirmedCount < settings.limit;
									let rsvp: Rsvp;
									if (hasCapacity) {
										rsvp = yield* writeRsvp(parsed.authId, {
											status: "confirmed",
											waitlistPosition: null,
											confirmedAt: timestamp,
											waitlistedAt: null,
											cancelledAt: null,
											cancelledByAuthId: null,
										});
									} else if (settings.waitlistEnabled) {
										rsvp = yield* writeRsvp(parsed.authId, {
											status: "waitlisted",
											waitlistPosition:
												yield* nextWaitlistPosition(),
											waitlistedAt: timestamp,
											confirmedAt: null,
											cancelledAt: null,
											cancelledByAuthId: null,
										});
									} else {
										return yield* Effect.fail(
											new HackKitError(
												"INVALID_OPERATION",
												"RSVP capacity has been reached.",
											),
										);
									}
									yield* queueRsvpIntent(rsvp);
									return rsvp;
								}),
						);
					}),
				),
			);
		},
		cancel(input: unknown): Effect.Effect<Rsvp, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "rsvp", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(
							adminCancelRsvpSchema,
							input,
						);
						return yield* withDomainLogEffect(
							logger,
							"rsvp.cancel",
							{
								actorAuthId: parsed.actorAuthId,
								targetAuthId: parsed.targetAuthId,
							},
							() =>
								Effect.gen(function* () {
									yield* fromResult(
										requirePermission(
											parsed.actorAuthId,
											CorePermission.UsersApprove,
										),
									);
									yield* fromResult(
										getUserOrThrow(parsed.targetAuthId),
									);
									const timestamp = now();
									const rsvp = yield* writeRsvp(
										parsed.targetAuthId,
										{
											status: "cancelled",
											waitlistPosition: null,
											cancelledAt: timestamp,
											cancelledByAuthId:
												parsed.actorAuthId,
										},
									);
									yield* renumberWaitlist();
									return rsvp;
								}),
						);
					}),
				),
			);
		},
		setStatus(input: unknown): Effect.Effect<Rsvp, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "rsvp", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(
							adminSetRsvpStatusSchema,
							input,
						);
						return yield* withDomainLogEffect(
							logger,
							"rsvp.setStatus",
							{
								actorAuthId: parsed.actorAuthId,
								targetAuthId: parsed.targetAuthId,
							},
							() =>
								Effect.gen(function* () {
									yield* fromResult(
										requirePermission(
											parsed.actorAuthId,
											CorePermission.UsersApprove,
										),
									);
									yield* assertApprovedHacker(
										parsed.targetAuthId,
									);
									const timestamp = now();
									const patch: Partial<Rsvp> =
										parsed.status === "confirmed"
											? {
													status: "confirmed",
													waitlistPosition: null,
													confirmedAt: timestamp,
													cancelledAt: null,
													cancelledByAuthId: null,
												}
											: parsed.status === "waitlisted"
												? {
														status: "waitlisted",
														waitlistPosition:
															yield* nextWaitlistPosition(),
														waitlistedAt: timestamp,
														cancelledAt: null,
														cancelledByAuthId: null,
													}
												: {
														status: "cancelled",
														waitlistPosition: null,
														cancelledAt: timestamp,
														cancelledByAuthId:
															parsed.actorAuthId,
													};
									const rsvp = yield* writeRsvp(
										parsed.targetAuthId,
										patch,
									);
									yield* renumberWaitlist();
									yield* queueRsvpIntent(rsvp);
									return rsvp;
								}),
						);
					}),
				),
			);
		},
		promote(input: unknown): Effect.Effect<Rsvp, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "rsvp", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(
							adminPromoteRsvpSchema,
							input,
						);
						return yield* withDomainLogEffect(
							logger,
							"rsvp.promote",
							{
								actorAuthId: parsed.actorAuthId,
								targetAuthId: parsed.targetAuthId,
							},
							() =>
								Effect.gen(function* () {
									yield* fromResult(
										requirePermission(
											parsed.actorAuthId,
											CorePermission.UsersApprove,
										),
									);
									const summary = yield* getSummary();
									if (
										summary.limit !== 0 &&
										summary.confirmedCount >= summary.limit
									) {
										return yield* Effect.fail(
											new HackKitError(
												"INVALID_OPERATION",
												"RSVP capacity has been reached.",
											),
										);
									}
									const target = parsed.targetAuthId
										? yield* fromResult(
												em.findOne(coreModels.rsvp, {
													authId: parsed.targetAuthId,
													status: "waitlisted",
												}),
											)
										: sortWaitlist(yield* listAll())[0];
									if (!target) {
										return yield* Effect.fail(
											new HackKitError(
												"NOT_FOUND",
												"Waitlisted RSVP not found.",
											),
										);
									}
									yield* assertApprovedHacker(target.authId);
									const timestamp = now();
									const rsvp = yield* writeRsvp(
										target.authId,
										{
											status: "confirmed",
											waitlistPosition: null,
											confirmedAt: timestamp,
											promotedAt: timestamp,
											promotedByAuthId:
												parsed.actorAuthId,
										},
									);
									yield* renumberWaitlist();
									yield* queueRsvpIntent(
										rsvp,
										parsed.actorAuthId,
									);
									return rsvp;
								}),
						);
					}),
				),
			);
		},
	};
}
export type RsvpApi = ReturnType<typeof createRsvpApi>;
export function createRsvpApi(context: RsvpApiContext) {
	return promiseApi(createRsvpEffects(context));
}
