import { promiseApi, type BoundaryError, fromResult } from "../effect";
import { Effect } from "effect";

import { type EntityManager } from "@mikro-orm/core";
import { HackKitError } from "../errors";
import { coreModels } from "../models";
import { CoreSetting, type SettingValue } from "../settings";
import { type AuthId, type Hacker } from "../types";
type RegistrationPolicyContext = {
	em: EntityManager;
	getSettingValue: (key: CoreSetting) => Promise<SettingValue>;
};
export type RegisterNewHackerPolicyResult = {
	requireApproval: boolean;
};
function isLimitReached(limit: number, count: number): boolean {
	return limit > 0 && count >= limit;
}
export function createCompetitorRegistrationPolicyEffects(
	context: RegistrationPolicyContext,
) {
	const { em, getSettingValue } = context;
	function countHackers(
		where?: Partial<Hacker>,
	): Effect.Effect<number, BoundaryError> {
		return Effect.suspend(() =>
			fromResult(em.count(coreModels.hacker, where ?? {})),
		);
	}
	function countApprovedHackers(): Effect.Effect<number, BoundaryError> {
		return Effect.gen(function* () {
			const approvedUsers = yield* fromResult(
				em.find(coreModels.user, {
					isApproved: true,
				}),
			);
			const approvedUserIds = new Set(
				approvedUsers.map((user) => user.id),
			);
			return (yield* fromResult(em.find(coreModels.hacker, {}))).filter(
				(hacker) => approvedUserIds.has(hacker.userId),
			).length;
		});
	}
	function assertCapacityAvailable(): Effect.Effect<void, BoundaryError> {
		return Effect.gen(function* () {
			const hackathonCapacity = yield* fromResult(
				getSettingValue(CoreSetting.HackathonCapacity),
			);
			if (
				typeof hackathonCapacity === "number" &&
				isLimitReached(hackathonCapacity, yield* countApprovedHackers())
			) {
				return yield* Effect.fail(
					new HackKitError(
						"INVALID_OPERATION",
						"Hackathon capacity has been reached.",
					),
				);
			}
		});
	}
	return {
		assertCanRegisterNewHacker(): Effect.Effect<
			RegisterNewHackerPolicyResult,
			BoundaryError
		> {
			return Effect.gen(function* () {
				const registrationOpen = yield* fromResult(
					getSettingValue(CoreSetting.RegistrationOpen),
				);
				if (!registrationOpen) {
					return yield* Effect.fail(
						new HackKitError(
							"INVALID_OPERATION",
							"Hacker registration is closed.",
						),
					);
				}
				const maximumRegistrations = yield* fromResult(
					getSettingValue(CoreSetting.MaximumRegistrations),
				);
				if (
					typeof maximumRegistrations === "number" &&
					isLimitReached(maximumRegistrations, yield* countHackers())
				) {
					return yield* Effect.fail(
						new HackKitError(
							"INVALID_OPERATION",
							"Maximum registrations has been reached.",
						),
					);
				}
				const requireApproval = Boolean(
					yield* fromResult(
						getSettingValue(CoreSetting.RequireApproval),
					),
				);
				if (!requireApproval) {
					yield* assertCapacityAvailable();
				}
				return { requireApproval };
			});
		},
		assertCanApproveUser(
			authId: AuthId,
		): Effect.Effect<void, BoundaryError> {
			return Effect.gen(function* () {
				const hacker = yield* fromResult(
					em.findOne(coreModels.hacker, {
						userId: authId,
					}),
				);
				if (!hacker) return;
				yield* assertCapacityAvailable();
			});
		},
	};
}
export type CompetitorRegistrationPolicy = ReturnType<
	typeof createCompetitorRegistrationPolicy
>;
export function createCompetitorRegistrationPolicy(
	context: RegistrationPolicyContext,
) {
	return promiseApi(createCompetitorRegistrationPolicyEffects(context));
}
