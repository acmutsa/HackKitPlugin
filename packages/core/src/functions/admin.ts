import { serialize } from "@mikro-orm/core";
import { readUser, toUser } from "../mikro/user.js";
import type { HackkitRuntimeContext } from "../hackkit-context.js";
import { coreModels } from "../models.js";
import { CorePermission } from "../permissions.js";
import type {
	AdminOverview,
	AdminUserExportRow,
	AdminUserRecord,
	AuthId,
	Role,
} from "../types.js";

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

export function createAdminApi(context: AdminApiContext) {
	const { em, requirePermission, getUserOrThrow } = context;

	async function listRolesForAdmin(actorAuthId: AuthId): Promise<Role[]> {
		await requirePermission(actorAuthId, CorePermission.RolesView);
		return serialize(
			await em.find(
				coreModels.role,
				{},
				{ orderBy: { position: "asc" } },
			),
		);
	}

	async function hydrateUser(
		user: AdminUserRecord["user"],
	): Promise<AdminUserRecord> {
		const [userData, hacker, rsvp, role, ban] = await Promise.all([
			em.findOne(coreModels.userData, { authId: user.authId }),
			em.findOne(coreModels.hacker, { authId: user.authId }),
			em.findOne(coreModels.rsvp, { authId: user.authId }),
			user.roleId
				? em.findOne(coreModels.role, { id: user.roleId })
				: null,
			em.findOne(coreModels.userBan, { authId: user.authId }),
		]);

		return {
			user,
			userData: userData ? serialize(userData) : null,
			hacker: hacker ? serialize(hacker) : null,
			rsvp: rsvp ? serialize(rsvp) : null,
			role: role ? serialize(role) : null,
			ban: ban ? serialize(ban) : null,
		};
	}

	async function listUsers(input: {
		actorAuthId: AuthId;
	}): Promise<AdminUserRecord[]> {
		await requirePermission(input.actorAuthId, CorePermission.UsersView);
		const users = await em.find(
			coreModels.user,
			{},
			{ orderBy: { createdAt: "desc" } },
		);
		return Promise.all(
			users.map(async (profile) =>
				hydrateUser(await toUser(em, profile)),
			),
		);
	}

	async function getUser(input: {
		actorAuthId: AuthId;
		targetAuthId: AuthId;
	}): Promise<AdminUserRecord | null> {
		await requirePermission(input.actorAuthId, CorePermission.UsersView);
		const user = await readUser(em, { authId: input.targetAuthId });
		return user ? hydrateUser(user) : null;
	}

	async function getUserByHackTag(input: {
		actorAuthId: AuthId;
		hackTag: string;
	}): Promise<AdminUserRecord | null> {
		await requirePermission(input.actorAuthId, CorePermission.UsersView);
		const user = await readUser(em, {
			hackTag: input.hackTag.toLowerCase(),
		});
		return user ? hydrateUser(user) : null;
	}

	async function getOverview(input: {
		actorAuthId: AuthId;
	}): Promise<AdminOverview> {
		await requirePermission(input.actorAuthId, CorePermission.Admin);
		const records = await listUsers({ actorAuthId: input.actorAuthId });
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
			const bucket = recentCounts.get(toDateKey(record.user.createdAt));
			if (bucket) bucket.count += 1;
		}

		return {
			totalUsers: records.length,
			totalHackers: records.filter((record) => record.hacker).length,
			approvedUsers: records.filter((record) => record.user.isApproved)
				.length,
			pendingApprovalUsers: records.filter(
				(record) => !record.user.isApproved && !record.ban,
			).length,
			bannedUsers: records.filter((record) => record.ban).length,
			checkedInUsers: records.filter((record) => record.user.checkedInAt)
				.length,
			confirmedRsvps: records.filter(
				(record) => record.rsvp?.status === "confirmed",
			).length,
			waitlistedRsvps: records.filter(
				(record) => record.rsvp?.status === "waitlisted",
			).length,
			recentSignups,
			recentUsers: records.slice(0, 10),
		};
	}

	async function exportUsers(input: {
		actorAuthId: AuthId;
	}): Promise<AdminUserExportRow[]> {
		const records = await listUsers({ actorAuthId: input.actorAuthId });
		return records.map(({ user, userData, hacker, rsvp, role, ban }) => ({
			authId: user.authId,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
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
			dietaryRestrictions: userData?.dietaryRestrictions.join("; ") ?? "",
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
		}));
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
