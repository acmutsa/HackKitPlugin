import {
	promiseApi,
	type BoundaryError,
	fromResult,
	operation,
	originalError,
	boundaryError,
} from "@hackkit/core/effect";
import { Cause, Effect } from "effect";

import { wrap } from "@mikro-orm/core";
import {
	coreModels,
	HackKitError,
	withOperationLockEffect,
	type AuthId,
	type HackKitPluginContext,
	type HackkitGroup,
} from "@hackkit/core";
import {
	discordModels,
	type DiscordMember,
	type DiscordRoleSyncAttempt,
	type DiscordVerification,
} from "./models";
export type DiscordRoleRef = {
	id?: string;
	name?: string;
};
export type DiscordRoleSyncInput = {
	authId: AuthId;
	discordUserId: string;
	guildId: string;
	roleIds: string[];
	roleNames: string[];
	nickname?: string;
};
export type DiscordRoleSyncProvider = {
	syncRoles(input: DiscordRoleSyncInput): Promise<{
		externalId?: string;
	} | void>;
};
export type DiscordPluginOptions = {
	guildId: string;
	verificationBaseUrl: string;
	verificationTtlMs?: number;
	participantRole?: DiscordRoleRef;
	roleMappings?: Record<string, DiscordRoleRef>;
	groupRoleMappings?: Record<string, DiscordRoleRef>;
	roleSyncProvider?: DiscordRoleSyncProvider;
};
export type CreateDiscordVerificationInput = {
	code: string;
	discordUserId: string;
	guildId?: string;
	username: string;
	avatarHash?: string;
};
export type ConfirmDiscordVerificationInput = {
	authId: AuthId;
	code: string;
};
export type DiscordRoleSyncPlan = {
	member: DiscordMember;
	roleIds: string[];
	roleNames: string[];
	nickname: string;
};
const defaultVerificationTtlMs = 5 * 60 * 1000;
function addMs(date: Date, ms: number): Date {
	return new Date(date.getTime() + ms);
}
function roleRefsEqual(left: DiscordRoleRef, right: DiscordRoleRef): boolean {
	return Boolean(
		(left.id && left.id === right.id) ||
			(left.name && left.name === right.name),
	);
}
function appendRole(roles: DiscordRoleRef[], role?: DiscordRoleRef): void {
	if (!role?.id && !role?.name) return;
	if (roles.some((existing) => roleRefsEqual(existing, role))) return;
	roles.push(role);
}
function roleForGroup(
	group: HackkitGroup | undefined,
	options: DiscordPluginOptions,
): DiscordRoleRef | undefined {
	if (!group) return undefined;
	return (
		options.groupRoleMappings?.[group.id] ?? {
			id: group.discordRoleId,
			name: group.discordRoleName,
		}
	);
}
function toVerificationUrl(baseUrl: string, code: string): string {
	const url = new URL("/discord/verify", baseUrl);
	url.searchParams.set("code", code);
	return url.toString();
}
function isExpired(verification: DiscordVerification, now: Date): boolean {
	return verification.expiresAt.getTime() <= now.getTime();
}
export function createDiscordEffects(
	context: HackKitPluginContext,
	options: DiscordPluginOptions,
) {
	const { em } = context;
	const ttlMs = options.verificationTtlMs ?? defaultVerificationTtlMs;
	function getMember(
		authId: AuthId,
	): Effect.Effect<DiscordMember | null, BoundaryError> {
		return Effect.gen(function* () {
			const member = yield* fromResult(
				em.findOne(discordModels.member, { authId }),
			);
			return member ? wrap(member).toObject() : null;
		});
	}
	function buildRoleSyncPlan(
		authId: AuthId,
	): Effect.Effect<DiscordRoleSyncPlan, BoundaryError> {
		return Effect.gen(function* () {
			const [member, user, hacker] = yield* Effect.all(
				[
					getMember(authId),
					fromResult(em.findOne(coreModels.user, { id: authId })),
					fromResult(
						em.findOne(coreModels.hacker, { userId: authId }),
					),
				],
				{ concurrency: "unbounded" },
			);
			if (!member) {
				return yield* Effect.fail(
					new HackKitError(
						"NOT_FOUND",
						"Discord account is not linked.",
					),
				);
			}
			if (!user) {
				return yield* Effect.fail(
					new HackKitError("NOT_FOUND", "User not found."),
				);
			}
			const roleRefs: DiscordRoleRef[] = [];
			appendRole(roleRefs, options.participantRole);
			if (user.roleId)
				appendRole(roleRefs, options.roleMappings?.[user.roleId]);
			const assignedGroup = context.groups.find(
				(candidate) => candidate.id === hacker?.group,
			);
			appendRole(roleRefs, roleForGroup(assignedGroup, options));
			return {
				member,
				roleIds: roleRefs.flatMap((role) => (role.id ? [role.id] : [])),
				roleNames: roleRefs.flatMap((role) =>
					role.name ? [role.name] : [],
				),
				nickname: user.name,
			};
		});
	}
	function recordRoleSyncAttempt(input: {
		plan: DiscordRoleSyncPlan;
		status: DiscordRoleSyncAttempt["status"];
		error?: string;
	}): Effect.Effect<DiscordRoleSyncAttempt, BoundaryError> {
		return Effect.gen(function* () {
			{
				const created = em.create(discordModels.roleSyncAttempt, {
					authId: input.plan.member.authId,
					discordUserId: input.plan.member.discordUserId,
					guildId: input.plan.member.guildId,
					status: input.status,
					roleIds: input.plan.roleIds,
					roleNames: input.plan.roleNames,
					error: input.error,
				});
				yield* fromResult(em.flush());
				return wrap(created).toObject();
			}
		});
	}
	return {
		createVerification(
			input: CreateDiscordVerificationInput,
		): Effect.Effect<
			DiscordVerification & {
				verificationUrl: string;
			},
			BoundaryError
		> {
			return Effect.gen(function* () {
				const guildId = input.guildId ?? options.guildId;
				if (guildId !== options.guildId) {
					return yield* Effect.fail(
						new HackKitError(
							"FORBIDDEN",
							"Discord guild is not configured.",
						),
					);
				}
				const now = new Date();
				const verification = em.create(discordModels.verification, {
					code: input.code,
					discordUserId: input.discordUserId,
					guildId,
					username: input.username,
					avatarHash: input.avatarHash,
					status: "pending",
					expiresAt: addMs(now, ttlMs),
					createdAt: now,
				});
				yield* fromResult(em.flush());
				return {
					...wrap(verification).toObject(),
					verificationUrl: toVerificationUrl(
						options.verificationBaseUrl,
						input.code,
					),
				};
			});
		},
		getVerification(
			code: string,
		): Effect.Effect<DiscordVerification | null, BoundaryError> {
			return Effect.gen(function* () {
				const verification = yield* fromResult(
					em.findOne(discordModels.verification, {
						code,
					}),
				);
				return verification ? wrap(verification).toObject() : null;
			});
		},
		getMember,
		confirmVerification(
			input: ConfirmDiscordVerificationInput,
		): Effect.Effect<DiscordMember, BoundaryError> {
			return Effect.gen(this, function* () {
				const result = yield* withOperationLockEffect(
					em,
					"discord.verification",
					() =>
						Effect.gen(function* () {
							const verification = yield* fromResult(
								em.findOne(discordModels.verification, {
									code: input.code,
								}),
							);
							if (!verification)
								return yield* Effect.fail(
									new HackKitError(
										"NOT_FOUND",
										"Discord verification was not found.",
									),
								);
							if (verification.status !== "pending")
								return yield* Effect.fail(
									new HackKitError(
										"INVALID_OPERATION",
										"Discord verification is no longer pending.",
									),
								);
							const now = new Date();
							if (isExpired(verification, now)) {
								verification.status = "expired";
								yield* fromResult(em.flush());
								return {
									error: new HackKitError(
										"INVALID_OPERATION",
										"Discord verification expired.",
									),
								};
							}
							const [user, hacker] = yield* Effect.all(
								[
									fromResult(
										em.findOne(coreModels.user, {
											id: input.authId,
										}),
									),
									fromResult(
										em.findOne(coreModels.hacker, {
											userId: input.authId,
										}),
									),
								],
								{ concurrency: "unbounded" },
							);
							if (!user)
								return yield* Effect.fail(
									new HackKitError(
										"NOT_FOUND",
										"User not found.",
									),
								);
							if (!user.isApproved || !hacker)
								return yield* Effect.fail(
									new HackKitError(
										"FORBIDDEN",
										"Only approved Hackers can link Discord.",
									),
								);
							const linked = yield* fromResult(
								em.findOne(discordModels.member, {
									discordUserId: verification.discordUserId,
								}),
							);
							if (linked && linked.authId !== input.authId) {
								verification.status = "rejected";
								yield* fromResult(em.flush());
								return {
									error: new HackKitError(
										"CONFLICT",
										"Discord account is already linked to another user.",
									),
								};
							}
							const existing = yield* fromResult(
								em.findOne(discordModels.member, {
									authId: input.authId,
								}),
							);
							const values = {
								authId: input.authId,
								discordUserId: verification.discordUserId,
								guildId: verification.guildId,
								username: verification.username,
								avatarHash: verification.avatarHash,
								verifiedAt: existing?.verifiedAt ?? now,
								updatedAt: now,
							};
							const member = existing
								? em.assign(existing, values)
								: em.create(discordModels.member, values);
							em.assign(verification, {
								status: "accepted",
								authId: input.authId,
								acceptedAt: now,
							});
							yield* fromResult(em.flush());
							return {
								member: wrap(member).toObject(),
							};
						}),
				);
				if (result.error)
					return yield* Effect.fail(boundaryError(result.error));
				// The link and consumed code have committed before contacting Discord.
				yield* this.syncMemberRoles({ authId: input.authId });
				return result.member;
			});
		},
		buildRoleSyncPlan(input: {
			authId: AuthId;
		}): Effect.Effect<DiscordRoleSyncPlan, BoundaryError> {
			return Effect.suspend(() => buildRoleSyncPlan(input.authId));
		},
		syncMemberRoles(input: {
			authId: AuthId;
		}): Effect.Effect<DiscordRoleSyncAttempt, BoundaryError> {
			return Effect.gen(function* () {
				const plan = yield* buildRoleSyncPlan(input.authId);
				if (!options.roleSyncProvider)
					return yield* recordRoleSyncAttempt({
						plan,
						status: "skipped",
					});
				const provider = options.roleSyncProvider;
				const result = yield* Effect.gen(function* () {
					yield* operation(() =>
						provider.syncRoles({
							authId: plan.member.authId,
							discordUserId: plan.member.discordUserId,
							guildId: plan.member.guildId,
							roleIds: plan.roleIds,
							roleNames: plan.roleNames,
							nickname: plan.nickname,
						}),
					);
					const rows = yield* operation(() =>
						em.find(discordModels.member, {
							authId: plan.member.authId,
						}),
					);
					for (const row of rows)
						em.assign(
							row,
							{
								lastRoleSyncAt: new Date(),
								updatedAt: new Date(),
							},
							{ ignoreUndefined: true },
						);
					yield* operation(() => em.flush());
					return { status: "synced" as const };
				}).pipe(
					Effect.catchAllCause((cause) => {
						const error = originalError(Cause.squash(cause));
						return Effect.succeed({
							status: "failed" as const,
							error:
								error instanceof Error
									? error.message
									: "Role sync failed.",
						});
					}),
				);
				return yield* recordRoleSyncAttempt({ plan, ...result });
			});
		},
		models: discordModels,
	};
}
export type DiscordApi = ReturnType<typeof createDiscordApi>;
export function createDiscordApi(
	context: HackKitPluginContext,
	options: DiscordPluginOptions,
) {
	return promiseApi(createDiscordEffects(context, options));
}
