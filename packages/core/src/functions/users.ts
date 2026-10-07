import { serialize } from "@mikro-orm/core";
import { withOperationLock } from "../mikro/operation.js";
import { readUser, toUser } from "../mikro/user.js";
import type { HackkitRuntimeContext } from "../hackkit-context.js";
import { HackKitError, parseInput } from "../errors.js";
import { withDomainLog } from "../domain-log.js";
import { coreModels } from "../models.js";
import { CorePermission } from "../permissions.js";
import type { CompetitorRegistrationPolicy } from "./registration-policy.js";
import {
	approveUserSchema,
	banUserSchema,
	checkInUserSchema,
	claimHackTagSchema,
	clearCheckInUserSchema,
	unbanUserSchema,
	updateUserProfileSchema,
} from "../schemas.js";
import type { AuthId, PublicUserProfile, User, UserBan } from "../types.js";

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
	groups: { assignNextGroup(authId: AuthId): Promise<unknown> };
};

export function createUsersApi(context: UsersApiContext) {
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
		async getUser(authId: AuthId): Promise<User | null> {
			return readUser(em, { id: authId });
		},

		async getUserByHackTag(hackTag: string): Promise<User | null> {
			const parsedHackTag = parseInput(
				claimHackTagSchema.shape.hackTag,
				hackTag,
			);
			return readUser(em, { hackTag: parsedHackTag });
		},

		async getPublicProfileByHackTag(
			hackTag: string,
		): Promise<PublicUserProfile | null> {
			const user = await this.getUserByHackTag(hackTag);
			if (!user || !user.isProfileSearchable) return null;
			const [hacker, role] = await Promise.all([
				em.findOne(coreModels.hacker, { authId: user.authId }),
				user.roleId
					? em.findOne(coreModels.role, { id: user.roleId })
					: null,
			]);
			return {
				user: {
					authId: user.authId,
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
		},

		async getUserBan(authId: AuthId): Promise<UserBan | null> {
			const record = await em.findOne(coreModels.userBan, { authId });
			return record ? serialize(record) : null;
		},

		async listUsers(input?: { actorAuthId?: AuthId }): Promise<User[]> {
			if (input?.actorAuthId)
				await requirePermission(
					input.actorAuthId,
					CorePermission.UsersView,
				);
			const users = await em.find(
				coreModels.user,
				{},
				{ orderBy: { createdAt: "desc" } },
			);
			return users.map(toUser);
		},

		async claimHackTag(input: unknown): Promise<User> {
			const parsed = parseInput(claimHackTagSchema, input);
			const profileKey = `profile:${parsed.authId}`;
			return withOperationLock(em, profileKey, async () => {
				return withDomainLog(
					logger,
					"users.claimHackTag",
					{ targetAuthId: parsed.authId },
					async () => {
						await getUserOrThrow(parsed.authId);
						const existing = await em.findOne(coreModels.user, {
							hackTag: parsed.hackTag,
						});
						if (existing && existing.id !== parsed.authId) {
							throw new HackKitError(
								"CONFLICT",
								"HackTag is already claimed.",
							);
						}
						const updated = await em.findOne(coreModels.user, {
							id: parsed.authId,
						});
						if (updated) {
							em.assign(
								updated,
								{
									hackTag: parsed.hackTag,
									updatedAt: now(),
								},
								{ ignoreUndefined: true },
							);
							await em.flush();
						}
						if (!updated)
							throw new HackKitError(
								"NOT_FOUND",
								"User not found.",
							);
						return getUserOrThrow(updated.id);
					},
				);
			});
		},

		async updateProfile(input: unknown): Promise<User> {
			const parsed = parseInput(updateUserProfileSchema, input);
			const profileKey = `profile:${parsed.authId}`;
			return withOperationLock(em, profileKey, async () => {
				return withDomainLog(
					logger,
					"users.updateProfile",
					{ targetAuthId: parsed.authId },
					async () => {
						await getUserOrThrow(parsed.authId);
						if (parsed.hackTag) {
							const existing = await em.findOne(coreModels.user, {
								hackTag: parsed.hackTag,
							});
							if (existing && existing.id !== parsed.authId) {
								throw new HackKitError(
									"CONFLICT",
									"HackTag is already claimed.",
								);
							}
						}
						const updated = await em.findOne(coreModels.user, {
							id: parsed.authId,
						});
						if (updated) {
							em.assign(
								updated,
								{
									name: parsed.name,
									profilePhotoUrl: parsed.profilePhotoUrl,
									hackTag: parsed.hackTag,
									bio: parsed.bio,
									pronouns: parsed.pronouns,
									skills: parsed.skills?.map((skill) =>
										skill.toLowerCase(),
									),
									isProfileSearchable:
										parsed.isProfileSearchable,
									discordDisplayHandle:
										parsed.discordDisplayHandle,
									updatedAt: now(),
								},
								{ ignoreUndefined: true },
							);
							await em.flush();
						}
						if (!updated)
							throw new HackKitError(
								"NOT_FOUND",
								"User not found.",
							);
						return getUserOrThrow(updated.id);
					},
				);
			});
		},

		async approveUser(input: unknown): Promise<User> {
			return withOperationLock(em, "registration", async () => {
				const parsed = parseInput(approveUserSchema, input);
				return withDomainLog(
					logger,
					"users.approveUser",
					{
						actorAuthId: parsed.actorAuthId,
						targetAuthId: parsed.targetAuthId,
					},
					async () => {
						const principal = await requirePermission(
							parsed.actorAuthId,
							CorePermission.UsersApprove,
						);
						const target = await getUserOrThrow(
							parsed.targetAuthId,
						);
						if (parsed.approved && !target.isApproved) {
							await registrationPolicy.assertCanApproveUser(
								parsed.targetAuthId,
							);
						}
						if (target.roleId)
							assertCanManageRole(
								principal,
								await getRoleOrThrow(target.roleId),
							);
						const updated = await em.findOne(coreModels.user, {
							id: parsed.targetAuthId,
						});
						if (updated) {
							em.assign(
								updated,
								{
									isApproved: parsed.approved,
									updatedAt: now(),
								},
								{ ignoreUndefined: true },
							);
							await em.flush();
						}
						if (!updated)
							throw new HackKitError(
								"NOT_FOUND",
								"User not found.",
							);
						if (parsed.approved) {
							await groups.assignNextGroup(parsed.targetAuthId);
						}
						return getUserOrThrow(updated.id);
					},
				);
			});
		},

		async banUser(input: unknown): Promise<UserBan> {
			return withOperationLock(em, "bans", async () => {
				const parsed = parseInput(banUserSchema, input);
				const principal = await requirePermission(
					parsed.actorAuthId,
					CorePermission.UsersBan,
				);
				const target = await getUserOrThrow(parsed.targetAuthId);
				if (target.roleId)
					assertCanManageRole(
						principal,
						await getRoleOrThrow(target.roleId),
					);
				const existing = await em.findOne(coreModels.userBan, {
					authId: parsed.targetAuthId,
				});
				if (existing) return existing;
				{
					const created = em.create(coreModels.userBan, {
						authId: parsed.targetAuthId,
						reason: parsed.reason,
						bannedByAuthId: parsed.actorAuthId,
						createdAt: now(),
					});
					await em.flush();
					return serialize(created);
				}
			});
		},

		async unbanUser(input: unknown): Promise<void> {
			return withOperationLock(em, "bans", async () => {
				const parsed = parseInput(unbanUserSchema, input);
				const principal = await requirePermission(
					parsed.actorAuthId,
					CorePermission.UsersBan,
				);
				const target = await getUserOrThrow(parsed.targetAuthId);
				if (target.roleId)
					assertCanManageRole(
						principal,
						await getRoleOrThrow(target.roleId),
					);
				await em.nativeDelete(coreModels.userBan, {
					authId: parsed.targetAuthId,
				});
			});
		},

		async checkIn(input: unknown): Promise<User> {
			return withOperationLock(em, "check-in", async () => {
				const parsed = parseInput(checkInUserSchema, input);
				return withDomainLog(
					logger,
					"users.checkIn",
					{
						actorAuthId: parsed.actorAuthId,
						targetAuthId: parsed.targetAuthId,
					},
					async () => {
						await requirePermission(
							parsed.actorAuthId,
							CorePermission.UsersCheckIn,
						);
						const target = await getUserOrThrow(
							parsed.targetAuthId,
						);
						if (target.checkedInAt) {
							throw new HackKitError(
								"INVALID_OPERATION",
								"User is already checked in.",
							);
						}
						const timestamp = now();
						const updated = await em.findOne(coreModels.user, {
							id: parsed.targetAuthId,
						});
						if (updated) {
							em.assign(
								updated,
								{
									checkedInAt: timestamp,
									updatedAt: timestamp,
								},
								{ ignoreUndefined: true },
							);
							await em.flush();
						}
						if (!updated)
							throw new HackKitError(
								"NOT_FOUND",
								"User not found.",
							);
						return getUserOrThrow(updated.id);
					},
				);
			});
		},

		async clearCheckIn(input: unknown): Promise<User> {
			return withOperationLock(em, "check-in", async () => {
				const parsed = parseInput(clearCheckInUserSchema, input);
				return withDomainLog(
					logger,
					"users.clearCheckIn",
					{
						actorAuthId: parsed.actorAuthId,
						targetAuthId: parsed.targetAuthId,
					},
					async () => {
						await requirePermission(
							parsed.actorAuthId,
							CorePermission.UsersCheckIn,
						);
						await getUserOrThrow(parsed.targetAuthId);
						const timestamp = now();
						const updated = await em.findOne(coreModels.user, {
							id: parsed.targetAuthId,
						});
						if (updated) {
							em.assign(
								updated,
								{
									checkedInAt: null,
									updatedAt: timestamp,
								},
								{ ignoreUndefined: true },
							);
							await em.flush();
						}
						if (!updated)
							throw new HackKitError(
								"NOT_FOUND",
								"User not found.",
							);
						return getUserOrThrow(updated.id);
					},
				);
			});
		},
	};
}
