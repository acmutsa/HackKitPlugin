import { promiseApi, type BoundaryError, fromResult } from "../effect";
import { Effect } from "effect";

import { serialize } from "@mikro-orm/core";
import { readUser } from "../mikro/user";
import { type HackkitRuntimeContext } from "../hackkit-context";
import { coreModels } from "../models";
import { CorePermission } from "../permissions";
import {
	type AdminOverview,
	type AdminUserExportRow,
	type AdminUserRecord,
	type AuthId,
	type Role,
} from "../types";
export type AdminApiContext = Pick<
	HackkitRuntimeContext,
	"em" | "requirePermission" | "getUserOrThrow"
>;
function toDateKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}
function toIsoString(date?: Date | null): string {
	return date ? date.toISOString() : "";
}
export function createAdminEffects(context: AdminApiContext) {
	const { em, requirePermission, getUserOrThrow } = context;
	function listRolesForAdmin(
		actorAuthId: AuthId,
	): Effect.Effect<Role[], BoundaryError> {
		return Effect.gen(function* () {
			yield* fromResult(
				requirePermission(actorAuthId, CorePermission.RolesView),
			);
			return serialize(
				yield* fromResult(
					em.find(
						coreModels.role,
						{},
						{ orderBy: { position: "asc" } },
					),
				),
			);
		});
	}
	function hydrateUser(
		user: AdminUserRecord["user"],
	): Effect.Effect<AdminUserRecord, BoundaryError> {
		return Effect.gen(function* () {
			const [userData, hacker, rsvp, role, ban] = yield* Effect.all(
				[
					fromResult(
						em.findOne(coreModels.userData, {
							authId: user.id,
						}),
					),
					fromResult(
						em.findOne(coreModels.hacker, { userId: user.id }),
					),
					fromResult(
						em.findOne(coreModels.rsvp, { authId: user.id }),
					),
					fromResult(
						user.roleId
							? em.findOne(coreModels.role, {
									id: user.roleId,
								})
							: null,
					),
					fromResult(
						em.findOne(coreModels.userBan, { authId: user.id }),
					),
				],
				{ concurrency: "unbounded" },
			);
			return {
				user,
				userData: userData ? serialize(userData) : null,
				hacker: hacker ? serialize(hacker) : null,
				rsvp: rsvp ? serialize(rsvp) : null,
				role: role ? serialize(role) : null,
				ban: ban ? serialize(ban) : null,
			};
		});
	}
	function listUsers(input: {
		actorAuthId: AuthId;
	}): Effect.Effect<AdminUserRecord[], BoundaryError> {
		return Effect.gen(function* () {
			yield* fromResult(
				requirePermission(input.actorAuthId, CorePermission.UsersView),
			);
			const users = yield* fromResult(
				em.find(
					coreModels.user,
					{},
					{ orderBy: { createdAt: "desc" } },
				),
			);
			return yield* Effect.forEach(
				serialize(users).map(hydrateUser),
				(value) => value,
				{ concurrency: "unbounded" },
			);
		});
	}
	function getUser(input: {
		actorAuthId: AuthId;
		targetAuthId: AuthId;
	}): Effect.Effect<AdminUserRecord | null, BoundaryError> {
		return Effect.gen(function* () {
			yield* fromResult(
				requirePermission(input.actorAuthId, CorePermission.UsersView),
			);
			const user = yield* fromResult(
				readUser(em, { id: input.targetAuthId }),
			);
			return yield* fromResult(user ? hydrateUser(user) : null);
		});
	}
	function getUserByHackTag(input: {
		actorAuthId: AuthId;
		hackTag: string;
	}): Effect.Effect<AdminUserRecord | null, BoundaryError> {
		return Effect.gen(function* () {
			yield* fromResult(
				requirePermission(input.actorAuthId, CorePermission.UsersView),
			);
			const user = yield* fromResult(
				readUser(em, {
					hackTag: input.hackTag.toLowerCase(),
				}),
			);
			return yield* fromResult(user ? hydrateUser(user) : null);
		});
	}
	function getOverview(input: {
		actorAuthId: AuthId;
	}): Effect.Effect<AdminOverview, BoundaryError> {
		return Effect.gen(function* () {
			yield* fromResult(
				requirePermission(input.actorAuthId, CorePermission.Admin),
			);
			const records = yield* listUsers({
				actorAuthId: input.actorAuthId,
			});
			const today = new Date();
			const recentSignups = Array.from({ length: 7 }, (_, index) => {
				const date = new Date(today);
				date.setUTCDate(today.getUTCDate() - index);
				return { date: toDateKey(date), count: 0 };
			}).reverse();
			const recentCounts = new Map(
				recentSignups.map((item) => [item.date, item]),
			);
			for (const record of records) {
				const bucket = recentCounts.get(
					toDateKey(record.user.createdAt),
				);
				if (bucket) bucket.count += 1;
			}
			return {
				totalUsers: records.length,
				totalHackers: records.filter((record) => record.hacker).length,
				approvedUsers: records.filter(
					(record) => record.user.isApproved,
				).length,
				pendingApprovalUsers: records.filter(
					(record) => !record.user.isApproved && !record.ban,
				).length,
				bannedUsers: records.filter((record) => record.ban).length,
				checkedInUsers: records.filter(
					(record) => record.user.checkedInAt,
				).length,
				confirmedRsvps: records.filter(
					(record) => record.rsvp?.status === "confirmed",
				).length,
				waitlistedRsvps: records.filter(
					(record) => record.rsvp?.status === "waitlisted",
				).length,
				recentSignups,
				recentUsers: records.slice(0, 10),
			};
		});
	}
	function exportUsers(input: {
		actorAuthId: AuthId;
	}): Effect.Effect<AdminUserExportRow[], BoundaryError> {
		return Effect.gen(function* () {
			const records = yield* listUsers({
				actorAuthId: input.actorAuthId,
			});
			return records.map(
				({
					user,
					userData,
					hacker,
					rsvp,
					role,
					ban,
				}): AdminUserExportRow => ({
					id: user.id,
					email: user.email,
					name: user.name,
					hackTag: user.hackTag ?? "",
					role: role?.name ?? "",
					isApproved: user.isApproved,
					isBanned: Boolean(ban),
					rsvpStatus: rsvp?.status ?? "",
					rsvpWaitlistPosition: rsvp?.waitlistPosition ?? "",
					banReason: ban?.reason ?? "",
					checkedInAt: toIsoString(user.checkedInAt),
					createdAt: user.createdAt.toISOString(),
					age: userData?.age ?? "",
					gender: userData?.gender ?? "",
					race: userData?.race ?? "",
					ethnicity: userData?.ethnicity ?? "",
					shirtSize: userData?.shirtSize ?? "",
					dietaryRestrictions:
						userData?.dietaryRestrictions.join("; ") ?? "",
					accommodationNote: userData?.accommodationNote ?? "",
					phoneNumber: userData?.phoneNumber ?? "",
					countryOfResidence: userData?.countryOfResidence ?? "",
					hasAcceptedMLHCodeOfConduct:
						userData?.hasAcceptedMLHCodeOfConduct ?? "",
					hasSharedDataWithMLH: userData?.hasSharedDataWithMLH ?? "",
					isEmailable: userData?.isEmailable ?? "",
					university: hacker?.university ?? "",
					major: hacker?.major ?? "",
					schoolId: hacker?.schoolId ?? "",
					levelOfStudy: hacker?.levelOfStudy ?? "",
					hackathonsAttended: hacker?.hackathonsAttended ?? "",
					softwareExperience: hacker?.softwareExperience ?? "",
					heardFrom: hacker?.heardFrom ?? "",
					githubUrl: hacker?.githubUrl ?? "",
					linkedInUrl: hacker?.linkedInUrl ?? "",
					personalWebsiteUrl: hacker?.personalWebsiteUrl ?? "",
					resumeUrl: hacker?.resumeUrl ?? "",
					group: hacker?.group ?? "",
					registeredAt: toIsoString(hacker?.registeredAt),
				}),
			);
		});
	}
	return {
		getOverview,
		getUser,
		getUserByHackTag,
		listRoles: listRolesForAdmin,
		listUsers,
		exportUsers,
	};
}
export function createAdminApi(context: AdminApiContext) {
	return promiseApi(createAdminEffects(context));
}
