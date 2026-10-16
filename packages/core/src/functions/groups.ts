import { promiseApi, type BoundaryError, fromResult } from "../effect";
import { Effect } from "effect";

import { serialize } from "@mikro-orm/core";
import { withOperationLockEffect } from "../mikro/operation";
import { HackKitError } from "../errors";
import { type HackkitRuntimeContext } from "../hackkit-context";
import { coreModels } from "../models";
import { type AuthId, type Hacker } from "../types";
import { type HackkitGroup, getEnabledGroups } from "../groups";

export type GroupsApiContext = Pick<
	HackkitRuntimeContext,
	"em" | "now" | "groups"
>;
function countAssignments(
	hackers: readonly Hacker[],
	groups: readonly HackkitGroup[],
): Map<string, number> {
	const counts = new Map(groups.map((group) => [group.id, 0]));
	for (const hacker of hackers) {
		if (!hacker.group || !counts.has(hacker.group)) continue;
		counts.set(hacker.group, (counts.get(hacker.group) ?? 0) + 1);
	}
	return counts;
}
export function createGroupsEffects(context: GroupsApiContext) {
	const { em, now, groups } = context;
	function assignGroupToHacker(
		authId: AuthId,
		groupId: string,
	): Effect.Effect<Hacker, BoundaryError> {
		return Effect.gen(function* () {
			const group = groups.find((candidate) => candidate.id === groupId);
			if (!group) {
				return yield* Effect.fail(
					new HackKitError("NOT_FOUND", "Group not found."),
				);
			}
			const updated = yield* fromResult(
				em.findOne(coreModels.hacker, { userId: authId }),
			);
			if (updated) {
				em.assign(
					updated,
					{ group: group.id, updatedAt: now() },
					{ ignoreUndefined: true },
				);
				yield* fromResult(em.flush());
			}
			if (!updated) {
				return yield* Effect.fail(
					new HackKitError("NOT_FOUND", "Hacker not found."),
				);
			}
			return serialize(updated);
		});
	}
	return {
		listGroups(): readonly HackkitGroup[] {
			return groups;
		},
		getGroupForAuthId(
			authId: AuthId,
		): Effect.Effect<HackkitGroup | null, BoundaryError> {
			return Effect.gen(function* () {
				const hacker = yield* fromResult(
					em.findOne(coreModels.hacker, {
						userId: authId,
					}),
				);
				if (!hacker?.group) return null;
				return (
					groups.find((group) => group.id === hacker.group) ?? null
				);
			});
		},
		assignGroup(input: {
			authId: AuthId;
			groupId: string;
		}): Effect.Effect<Hacker, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "groups", () =>
					Effect.suspend(() =>
						assignGroupToHacker(input.authId, input.groupId),
					),
				),
			);
		},
		assignNextGroup(
			authId: AuthId,
		): Effect.Effect<Hacker | null, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "groups", () =>
					Effect.gen(function* () {
						const hacker = yield* fromResult(
							em.findOne(coreModels.hacker, {
								userId: authId,
							}),
						);
						if (!hacker) return null;
						if (hacker.group) return serialize(hacker);
						const enabledGroups = getEnabledGroups(groups);
						if (enabledGroups.length === 0)
							return serialize(hacker);
						const hackers = yield* fromResult(
							em.find(coreModels.hacker, {}),
						);
						const counts = countAssignments(hackers, enabledGroups);
						const [nextGroup] = [...enabledGroups].sort(
							(left, right) => {
								const countDelta =
									(counts.get(left.id) ?? 0) -
									(counts.get(right.id) ?? 0);
								if (countDelta !== 0) return countDelta;
								return (
									enabledGroups.findIndex(
										(group) => group.id === left.id,
									) -
									enabledGroups.findIndex(
										(group) => group.id === right.id,
									)
								);
							},
						);
						if (!nextGroup) return serialize(hacker);
						return yield* assignGroupToHacker(authId, nextGroup.id);
					}),
				),
			);
		},
	};
}
export type GroupsApi = ReturnType<typeof createGroupsApi>;
export function createGroupsApi(context: GroupsApiContext) {
	return promiseApi(createGroupsEffects(context));
}
