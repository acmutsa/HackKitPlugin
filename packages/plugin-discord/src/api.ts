import { wrap } from "@mikro-orm/core";
import {
	coreModels,
	HackKitError,
	withOperationLock,
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
	syncRoles(
		input: DiscordRoleSyncInput,
	): Promise<{ externalId?: string } | void>;
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

export function createDiscordApi(
	context: HackKitPluginContext,
	options: DiscordPluginOptions,
) {
	const { em } = context;
	const ttlMs = options.verificationTtlMs ?? defaultVerificationTtlMs;

	async function getMember(authId: AuthId): Promise<DiscordMember | null> {
		const member = await em.findOne(discordModels.member, { authId });
		return member ? wrap(member).toObject() : null;
	}

	async function buildRoleSyncPlan(
		authId: AuthId,
	): Promise<DiscordRoleSyncPlan> {
		const [member, user, hacker] = await Promise.all([
			getMember(authId),
			em.findOne(coreModels.user, { id: authId }),
			em.findOne(coreModels.hacker, { authId }),
		]);
		if (!member) {
			throw new HackKitError(
				"NOT_FOUND",
				"Discord account is not linked.",
			);
		}
		if (!user) {
			throw new HackKitError("NOT_FOUND", "User not found.");
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
	}

	async function recordRoleSyncAttempt(input: {
		plan: DiscordRoleSyncPlan;
		status: DiscordRoleSyncAttempt["status"];
		error?: string;
	}): Promise<DiscordRoleSyncAttempt> {
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
			await em.flush();
			return wrap(created).toObject();
		}
	}

	return {
		async createVerification(
			input: CreateDiscordVerificationInput,
		): Promise<DiscordVerification & { verificationUrl: string }> {
			const guildId = input.guildId ?? options.guildId;
			if (guildId !== options.guildId) {
				throw new HackKitError(
					"FORBIDDEN",
					"Discord guild is not configured.",
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
			await em.flush();
			return {
				...wrap(verification).toObject(),
				verificationUrl: toVerificationUrl(
					options.verificationBaseUrl,
					input.code,
				),
			};
		},

		async getVerification(
			code: string,
		): Promise<DiscordVerification | null> {
			const verification = await em.findOne(discordModels.verification, {
				code,
			});
			return verification ? wrap(verification).toObject() : null;
		},

		getMember,

		async confirmVerification(
			input: ConfirmDiscordVerificationInput,
		): Promise<DiscordMember> {
			const result = await withOperationLock(
				em,
				"discord.verification",
				async () => {
					const verification = await em.findOne(
						discordModels.verification,
						{ code: input.code },
					);
					if (!verification)
						throw new HackKitError(
							"NOT_FOUND",
							"Discord verification was not found.",
						);
					if (verification.status !== "pending")
						throw new HackKitError(
							"INVALID_OPERATION",
							"Discord verification is no longer pending.",
						);
					const now = new Date();
					if (isExpired(verification, now)) {
						verification.status = "expired";
						await em.flush();
						return {
							error: new HackKitError(
								"INVALID_OPERATION",
								"Discord verification expired.",
							),
						};
					}
					const [user, hacker] = await Promise.all([
						em.findOne(coreModels.user, { id: input.authId }),
						em.findOne(coreModels.hacker, { authId: input.authId }),
					]);
					if (!user)
						throw new HackKitError("NOT_FOUND", "User not found.");
					if (!user.isApproved || !hacker)
						throw new HackKitError(
							"FORBIDDEN",
							"Only approved Hackers can link Discord.",
						);
					const linked = await em.findOne(discordModels.member, {
						discordUserId: verification.discordUserId,
					});
					if (linked && linked.authId !== input.authId) {
						verification.status = "rejected";
						await em.flush();
						return {
							error: new HackKitError(
								"CONFLICT",
								"Discord account is already linked to another user.",
							),
						};
					}
					const existing = await em.findOne(discordModels.member, {
						authId: input.authId,
					});
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
					await em.flush();
					return { member: wrap(member).toObject() };
				},
			);
			if (result.error) throw result.error;
			// The link and consumed code have committed before contacting Discord.
			await this.syncMemberRoles({ authId: input.authId });
			return result.member;
		},

		async buildRoleSyncPlan(input: {
			authId: AuthId;
		}): Promise<DiscordRoleSyncPlan> {
			return buildRoleSyncPlan(input.authId);
		},

		async syncMemberRoles(input: {
			authId: AuthId;
		}): Promise<DiscordRoleSyncAttempt> {
			const plan = await buildRoleSyncPlan(input.authId);
			if (!options.roleSyncProvider) {
				return recordRoleSyncAttempt({ plan, status: "skipped" });
			}
			try {
				await options.roleSyncProvider.syncRoles({
					authId: plan.member.authId,
					discordUserId: plan.member.discordUserId,
					guildId: plan.member.guildId,
					roleIds: plan.roleIds,
					roleNames: plan.roleNames,
					nickname: plan.nickname,
				});
				{
					const updatedRows = await em.find(discordModels.member, {
						authId: plan.member.authId,
					});
					for (const row of updatedRows)
						em.assign(
							row,
							{
								lastRoleSyncAt: new Date(),
								updatedAt: new Date(),
							},
							{ ignoreUndefined: true },
						);
					await em.flush();
				}
				return recordRoleSyncAttempt({ plan, status: "synced" });
			} catch (error) {
				return recordRoleSyncAttempt({
					plan,
					status: "failed",
					error:
						error instanceof Error
							? error.message
							: "Role sync failed.",
				});
			}
		},

		models: discordModels,
	};
}

export type DiscordApi = ReturnType<typeof createDiscordApi>;
