import { operation } from "../effect";
import { decodeInput } from "../effect-schema";
import { promiseApi, type BoundaryError, fromResult } from "../effect";
import { Effect } from "effect";

import { serialize } from "@mikro-orm/core";
import { withOperationLockEffect } from "../mikro/operation";
import { readUser } from "../mikro/user";
import { type HackkitRuntimeContext } from "../hackkit-context";
import { HackKitError } from "../errors";
import { withDomainLogEffect } from "../domain-log";
import { coreModels } from "../models";
import { CorePermission } from "../permissions";
import { type CompetitorRegistrationPolicy } from "./registration-policy";
import {
	approveUserSchema,
	banUserSchema,
	checkInUserSchema,
	claimHackTagSchema,
	clearCheckInUserSchema,
	unbanUserSchema,
	updateUserProfileSchema,
} from "../schemas";
import {
	type AuthId,
	type PublicUserProfile,
	type User,
	type UserBan,
} from "../types";
export type UsersApiContext = Pick<
	HackkitRuntimeContext,
	| "em"
	| "now"
	| "logger"
	| "getUserOrThrow"
	| "getRoleOrThrow"
	| "requirePermission"
	| "assertCanManageRole"
> & {
	registrationPolicy: CompetitorRegistrationPolicy;
	groups: {
		assignNextGroup(authId: AuthId): Promise<unknown>;
	};
};
export function createUsersEffects(context: UsersApiContext) {
	const {
		em,
		now,
		logger,
		getUserOrThrow,
		getRoleOrThrow,
		requirePermission,
		assertCanManageRole,
		registrationPolicy,
		groups,
	} = context;
	return {
		getUser(authId: AuthId): Effect.Effect<User | null, BoundaryError> {
			return Effect.suspend(() =>
				fromResult(readUser(em, { id: authId })),
			);
		},
		getUserByHackTag(
			hackTag: string,
		): Effect.Effect<User | null, BoundaryError> {
			return Effect.gen(function* () {
				const parsedHackTag = yield* decodeInput(
					claimHackTagSchema.shape.hackTag,
					hackTag,
				);
				return yield* fromResult(
					readUser(em, { hackTag: parsedHackTag }),
				);
			});
		},
		getPublicProfileByHackTag(
			hackTag: string,
		): Effect.Effect<PublicUserProfile | null, BoundaryError> {
			return Effect.gen(this, function* () {
				const user = yield* this.getUserByHackTag(hackTag);
				if (!user || !user.isProfileSearchable) return null;
				const [hacker, role] = yield* Effect.all(
					[
						fromResult(
							em.findOne(coreModels.hacker, {
								userId: user.id,
							}),
						),
						fromResult(
							user.roleId
								? em.findOne(coreModels.role, {
										id: user.roleId,
									})
								: null,
						),
					],
					{ concurrency: "unbounded" },
				);
				return {
					user: {
						id: user.id,
						name: user.name,
						profilePhotoUrl: user.profilePhotoUrl,
						hackTag: user.hackTag,
						bio: user.bio,
						pronouns: user.pronouns,
						skills: user.skills,
						discordDisplayHandle: user.discordDisplayHandle,
					},
					hacker: hacker
						? {
								university: hacker.university,
								major: hacker.major,
								levelOfStudy: hacker.levelOfStudy,
								githubUrl: hacker.githubUrl,
								linkedInUrl: hacker.linkedInUrl,
								personalWebsiteUrl: hacker.personalWebsiteUrl,
							}
						: null,
					role: role ? serialize(role) : null,
				};
			});
		},
		getUserBan(
			authId: AuthId,
		): Effect.Effect<UserBan | null, BoundaryError> {
			return Effect.gen(function* () {
				const record = yield* fromResult(
					em.findOne(coreModels.userBan, { authId }),
				);
				return record ? serialize(record) : null;
			});
		},
		listUsers(input?: {
			actorAuthId?: AuthId;
		}): Effect.Effect<User[], BoundaryError> {
			return Effect.gen(function* () {
				if (input?.actorAuthId)
					yield* fromResult(
						requirePermission(
							input.actorAuthId,
							CorePermission.UsersView,
						),
					);
				const users = yield* fromResult(
					em.find(
						coreModels.user,
						{},
						{ orderBy: { createdAt: "desc" } },
					),
				);
				return serialize(users);
			});
		},
		claimHackTag(input: unknown): Effect.Effect<User, BoundaryError> {
			return Effect.gen(function* () {
				const parsed = yield* decodeInput(claimHackTagSchema, input);
				const profileKey = `profile:${parsed.authId}`;
				return yield* withOperationLockEffect(em, profileKey, () =>
					Effect.suspend(() =>
						withDomainLogEffect(
							logger,
							"users.claimHackTag",
							{ targetAuthId: parsed.authId },
							() =>
								Effect.gen(function* () {
									yield* fromResult(
										getUserOrThrow(parsed.authId),
									);
									const existing = yield* fromResult(
										em.findOne(coreModels.user, {
											hackTag: parsed.hackTag,
										}),
									);
									if (
										existing &&
										existing.id !== parsed.authId
									) {
										return yield* Effect.fail(
											new HackKitError(
												"CONFLICT",
												"HackTag is already claimed.",
											),
										);
									}
									const updated = yield* fromResult(
										em.findOne(coreModels.user, {
											id: parsed.authId,
										}),
									);
									if (updated) {
										em.assign(
											updated,
											{
												hackTag: parsed.hackTag,
												updatedAt: now(),
											},
											{
												ignoreUndefined: true,
											},
										);
										yield* fromResult(em.flush());
									}
									if (!updated)
										return yield* Effect.fail(
											new HackKitError(
												"NOT_FOUND",
												"User not found.",
											),
										);
									return yield* fromResult(
										getUserOrThrow(updated.id),
									);
								}),
						),
					),
				);
			});
		},
		updateProfile(input: unknown): Effect.Effect<User, BoundaryError> {
			return Effect.gen(function* () {
				const parsed = yield* decodeInput(
					updateUserProfileSchema,
					input,
				);
				const profileKey = `profile:${parsed.authId}`;
				return yield* withOperationLockEffect(em, profileKey, () =>
					Effect.suspend(() =>
						withDomainLogEffect(
							logger,
							"users.updateProfile",
							{ targetAuthId: parsed.authId },
							() =>
								Effect.gen(function* () {
									yield* fromResult(
										getUserOrThrow(parsed.authId),
									);
									if (parsed.hackTag) {
										const existing = yield* fromResult(
											em.findOne(coreModels.user, {
												hackTag: parsed.hackTag,
											}),
										);
										if (
											existing &&
											existing.id !== parsed.authId
										) {
											return yield* Effect.fail(
												new HackKitError(
													"CONFLICT",
													"HackTag is already claimed.",
												),
											);
										}
									}
									const updated = yield* fromResult(
										em.findOne(coreModels.user, {
											id: parsed.authId,
										}),
									);
									if (updated) {
										em.assign(
											updated,
											{
												name: parsed.name,
												profilePhotoUrl:
													parsed.profilePhotoUrl,
												hackTag: parsed.hackTag,
												bio: parsed.bio,
												pronouns: parsed.pronouns,
												skills: parsed.skills?.map(
													(skill) =>
														skill.toLowerCase(),
												),
												isProfileSearchable:
													parsed.isProfileSearchable,
												discordDisplayHandle:
													parsed.discordDisplayHandle,
												updatedAt: now(),
											},
											{
												ignoreUndefined: true,
											},
										);
										yield* fromResult(em.flush());
									}
									if (!updated)
										return yield* Effect.fail(
											new HackKitError(
												"NOT_FOUND",
												"User not found.",
											),
										);
									return yield* fromResult(
										getUserOrThrow(updated.id),
									);
								}),
						),
					),
				);
			});
		},
		approveUser(input: unknown): Effect.Effect<User, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "registration", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(
							approveUserSchema,
							input,
						);
						return yield* withDomainLogEffect(
							logger,
							"users.approveUser",
							{
								actorAuthId: parsed.actorAuthId,
								targetAuthId: parsed.targetAuthId,
							},
							() =>
								Effect.gen(function* () {
									const principal = yield* fromResult(
										requirePermission(
											parsed.actorAuthId,
											CorePermission.UsersApprove,
										),
									);
									const target = yield* fromResult(
										getUserOrThrow(parsed.targetAuthId),
									);
									if (parsed.approved && !target.isApproved) {
										yield* fromResult(
											registrationPolicy.assertCanApproveUser(
												parsed.targetAuthId,
											),
										);
									}
									if (target.roleId)
										yield* operation(
											assertCanManageRole.bind(
												undefined,
												principal,
												yield* fromResult(
													getRoleOrThrow(
														target.roleId,
													),
												),
											),
										);
									const updated = yield* fromResult(
										em.findOne(coreModels.user, {
											id: parsed.targetAuthId,
										}),
									);
									if (updated) {
										em.assign(
											updated,
											{
												isApproved: parsed.approved,
												updatedAt: now(),
											},
											{
												ignoreUndefined: true,
											},
										);
										yield* fromResult(em.flush());
									}
									if (!updated)
										return yield* Effect.fail(
											new HackKitError(
												"NOT_FOUND",
												"User not found.",
											),
										);
									if (parsed.approved) {
										yield* fromResult(
											groups.assignNextGroup(
												parsed.targetAuthId,
											),
										);
									}
									return yield* fromResult(
										getUserOrThrow(updated.id),
									);
								}),
						);
					}),
				),
			);
		},
		banUser(input: unknown): Effect.Effect<UserBan, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "bans", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(banUserSchema, input);
						const principal = yield* fromResult(
							requirePermission(
								parsed.actorAuthId,
								CorePermission.UsersBan,
							),
						);
						const target = yield* fromResult(
							getUserOrThrow(parsed.targetAuthId),
						);
						if (target.roleId)
							yield* operation(
								assertCanManageRole.bind(
									undefined,
									principal,
									yield* fromResult(
										getRoleOrThrow(target.roleId),
									),
								),
							);
						const existing = yield* fromResult(
							em.findOne(coreModels.userBan, {
								authId: parsed.targetAuthId,
							}),
						);
						if (existing) return existing;
						{
							const created = em.create(coreModels.userBan, {
								authId: parsed.targetAuthId,
								reason: parsed.reason,
								bannedByAuthId: parsed.actorAuthId,
								createdAt: now(),
							});
							yield* fromResult(em.flush());
							return serialize(created);
						}
					}),
				),
			);
		},
		unbanUser(input: unknown): Effect.Effect<void, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "bans", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(
							unbanUserSchema,
							input,
						);
						const principal = yield* fromResult(
							requirePermission(
								parsed.actorAuthId,
								CorePermission.UsersBan,
							),
						);
						const target = yield* fromResult(
							getUserOrThrow(parsed.targetAuthId),
						);
						if (target.roleId)
							yield* operation(
								assertCanManageRole.bind(
									undefined,
									principal,
									yield* fromResult(
										getRoleOrThrow(target.roleId),
									),
								),
							);
						yield* fromResult(
							em.nativeDelete(coreModels.userBan, {
								authId: parsed.targetAuthId,
							}),
						);
					}),
				),
			);
		},
		checkIn(input: unknown): Effect.Effect<User, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "check-in", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(
							checkInUserSchema,
							input,
						);
						return yield* withDomainLogEffect(
							logger,
							"users.checkIn",
							{
								actorAuthId: parsed.actorAuthId,
								targetAuthId: parsed.targetAuthId,
							},
							() =>
								Effect.gen(function* () {
									yield* fromResult(
										requirePermission(
											parsed.actorAuthId,
											CorePermission.UsersCheckIn,
										),
									);
									const target = yield* fromResult(
										getUserOrThrow(parsed.targetAuthId),
									);
									if (target.checkedInAt) {
										return yield* Effect.fail(
											new HackKitError(
												"INVALID_OPERATION",
												"User is already checked in.",
											),
										);
									}
									const timestamp = now();
									const updated = yield* fromResult(
										em.findOne(coreModels.user, {
											id: parsed.targetAuthId,
										}),
									);
									if (updated) {
										em.assign(
											updated,
											{
												checkedInAt: timestamp,
												updatedAt: timestamp,
											},
											{
												ignoreUndefined: true,
											},
										);
										yield* fromResult(em.flush());
									}
									if (!updated)
										return yield* Effect.fail(
											new HackKitError(
												"NOT_FOUND",
												"User not found.",
											),
										);
									return yield* fromResult(
										getUserOrThrow(updated.id),
									);
								}),
						);
					}),
				),
			);
		},
		clearCheckIn(input: unknown): Effect.Effect<User, BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(em, "check-in", () =>
					Effect.gen(function* () {
						const parsed = yield* decodeInput(
							clearCheckInUserSchema,
							input,
						);
						return yield* withDomainLogEffect(
							logger,
							"users.clearCheckIn",
							{
								actorAuthId: parsed.actorAuthId,
								targetAuthId: parsed.targetAuthId,
							},
							() =>
								Effect.gen(function* () {
									yield* fromResult(
										requirePermission(
											parsed.actorAuthId,
											CorePermission.UsersCheckIn,
										),
									);
									yield* fromResult(
										getUserOrThrow(parsed.targetAuthId),
									);
									const timestamp = now();
									const updated = yield* fromResult(
										em.findOne(coreModels.user, {
											id: parsed.targetAuthId,
										}),
									);
									if (updated) {
										em.assign(
											updated,
											{
												checkedInAt: null,
												updatedAt: timestamp,
											},
											{
												ignoreUndefined: true,
											},
										);
										yield* fromResult(em.flush());
									}
									if (!updated)
										return yield* Effect.fail(
											new HackKitError(
												"NOT_FOUND",
												"User not found.",
											),
										);
									return yield* fromResult(
										getUserOrThrow(updated.id),
									);
								}),
						);
					}),
				),
			);
		},
	};
}
export function createUsersApi(context: UsersApiContext) {
	return promiseApi(createUsersEffects(context));
}
