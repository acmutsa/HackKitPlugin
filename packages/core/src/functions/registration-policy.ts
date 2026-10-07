import type { EntityManager } from "@mikro-orm/core";
import { HackKitError } from "../errors";
import { coreModels } from "../models";
import { CoreSetting, type SettingValue } from "../settings";
import type { AuthId, Hacker } from "../types";

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

export function createCompetitorRegistrationPolicy(
	context: RegistrationPolicyContext,
) {
	const { em, getSettingValue } = context;

	async function countHackers(where?: Partial<Hacker>): Promise<number> {
		return await em.count(coreModels.hacker, where ?? {});
	}

	async function countApprovedHackers(): Promise<number> {
		const approvedUsers = await em.find(coreModels.user, {
			isApproved: true,
		});
		const approvedAuthIds = new Set(approvedUsers.map((user) => user.id));
		return (await em.find(coreModels.hacker, {})).filter((hacker) =>
			approvedAuthIds.has(hacker.authId),
		).length;
	}

	async function assertCapacityAvailable(): Promise<void> {
		const hackathonCapacity = await getSettingValue(
			CoreSetting.HackathonCapacity,
		);
		if (
			typeof hackathonCapacity === "number" &&
			isLimitReached(hackathonCapacity, await countApprovedHackers())
		) {
			throw new HackKitError(
				"INVALID_OPERATION",
				"Hackathon capacity has been reached.",
			);
		}
	}

	return {
		async assertCanRegisterNewHacker(): Promise<RegisterNewHackerPolicyResult> {
			const registrationOpen = await getSettingValue(
				CoreSetting.RegistrationOpen,
			);
			if (!registrationOpen) {
				throw new HackKitError(
					"INVALID_OPERATION",
					"Hacker registration is closed.",
				);
			}

			const maximumRegistrations = await getSettingValue(
				CoreSetting.MaximumRegistrations,
			);
			if (
				typeof maximumRegistrations === "number" &&
				isLimitReached(maximumRegistrations, await countHackers())
			) {
				throw new HackKitError(
					"INVALID_OPERATION",
					"Maximum registrations has been reached.",
				);
			}

			const requireApproval = Boolean(
				await getSettingValue(CoreSetting.RequireApproval),
			);
			if (!requireApproval) {
				await assertCapacityAvailable();
			}

			return { requireApproval };
		},

		async assertCanApproveUser(authId: AuthId): Promise<void> {
			const hacker = await em.findOne(coreModels.hacker, { authId });
			if (!hacker) return;
			await assertCapacityAvailable();
		},
	};
}

export type CompetitorRegistrationPolicy = ReturnType<
	typeof createCompetitorRegistrationPolicy
>;
