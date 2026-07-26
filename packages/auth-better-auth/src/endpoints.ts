import {
	CorePermission,
	type CompleteUserDataInput,
	type CreateEventInput,
	type CreateRoleInput,
	type HackKit,
	type HackKitPlugin,
	type PermissionKey,
	type RegisterHackerInput,
	type SettingKey,
	type UpdateEventInput,
	type UpdateRoleInput,
	type UpdateUserProfileInput,
} from "@hackkit/core";
import type { TeamsApi } from "@hackkit/plugin-teams";
import type {
	CreateDiscordVerificationInput,
	DiscordApi,
} from "@hackkit/plugin-discord";
import type { EmailNotificationsApi } from "@hackkit/plugin-notifications-email";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import type { BetterAuthUser } from "./index";

type StandardSchema<TInput, TOutput = TInput> = {
	"~standard": {
		version: 1;
		vendor: "hackkit";
		types: { input: TInput; output: TOutput };
		validate(
			value: unknown,
		): { value: TOutput } | { issues: { message: string }[] };
	};
};

function body<T extends Record<string, unknown>>(): StandardSchema<T> {
	return {
		"~standard": {
			version: 1,
			vendor: "hackkit",
			types: {} as { input: T; output: T },
			validate(value) {
				return value &&
					typeof value === "object" &&
					!Array.isArray(value)
					? { value: value as T }
					: {
							issues: [
								{ message: "Request body must be an object." },
							],
						};
			},
		},
	};
}

type EndpointDependencies = {
	getDomain(): HackKit;
	getCurrentUser(
		user: BetterAuthUser,
	): Promise<Awaited<ReturnType<HackKit["users"]["ensureUser"]>>>;
	getOptions(): {
		eventTypes: HackKit["events"]["options"];
		userDataOptions: HackKit["userData"]["options"];
		groups: ReturnType<HackKit["groups"]["listGroups"]>;
		settings: HackKit["registry"]["settings"];
	};
};

type TeamsEndpoints = TeamsApi;
type DiscordEndpoints = DiscordApi;
type EmailEndpoints = EmailNotificationsApi;
type WithoutIdentity<T> = Omit<T, "actorAuthId" | "authId">;

const extensionEndpointNames = {
	teams: [
		"createHackkitTeam",
		"inviteToHackkitTeam",
		"respondToHackkitTeamInvite",
		"leaveHackkitTeam",
		"removeHackkitTeamMember",
		"getHackkitTeam",
		"listHackkitTeamMembers",
		"listPendingHackkitTeamInvites",
		"listHackkitTeamInvites",
	],
	discord: [
		"createHackkitDiscordVerification",
		"getHackkitDiscordVerification",
		"getHackkitDiscordMember",
		"confirmHackkitDiscordVerification",
		"getHackkitDiscordRoleSyncPlan",
		"syncHackkitDiscordRoles",
	],
	notificationsEmail: [
		"deliverPendingHackkitEmailNotifications",
		"deliverHackkitEmailNotification",
	],
} as const;

type ExtensionId = keyof typeof extensionEndpointNames;
type ExtensionEndpointName =
	(typeof extensionEndpointNames)[ExtensionId][number];
type InstalledExtensionId<TPlugins extends readonly HackKitPlugin[]> =
	string extends TPlugins[number]["id"]
		? ExtensionId
		: Extract<TPlugins[number]["id"], ExtensionId>;
type InstalledEndpointName<TPlugins extends readonly HackKitPlugin[]> =
	(typeof extensionEndpointNames)[InstalledExtensionId<TPlugins>][number];

export function selectInstalledHackkitEndpoints<
	TPlugins extends readonly HackKitPlugin[],
	TEndpoints extends Record<string, unknown>,
>(allEndpoints: TEndpoints, plugins: TPlugins) {
	const endpoints = { ...allEndpoints };
	const installed = new Set(plugins.map((plugin) => plugin.id));
	for (const [pluginId, names] of Object.entries(extensionEndpointNames)) {
		if (installed.has(pluginId)) continue;
		for (const name of names) delete endpoints[name];
	}
	return endpoints as Omit<TEndpoints, ExtensionEndpointName> &
		Pick<
			TEndpoints,
			Extract<InstalledEndpointName<TPlugins>, keyof TEndpoints>
		>;
}

export function createHackkitEndpoints(deps: EndpointDependencies) {
	const domain = () => deps.getDomain();
	const actor = async (ctx: {
		context: { session: { user: BetterAuthUser } };
	}) => {
		await deps.getCurrentUser(ctx.context.session.user);
		return ctx.context.session.user.id;
	};
	const ok = { success: true } as const;
	function plugin<T extends object>(id: string): T {
		const api = (domain().plugins as Record<string, unknown>)[id];
		if (!api) throw new Error(`HackKit plugin '${id}' is not installed.`);
		return api as T;
	}

	return {
		getHackkitOptions: createAuthEndpoint(
			"/hackkit/options",
			{ method: "GET" },
			async (ctx) => ctx.json(deps.getOptions()),
		),
		getHackkitMe: createAuthEndpoint(
			"/hackkit/me",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(await deps.getCurrentUser(ctx.context.session.user)),
		),
		getHackkitBan: createAuthEndpoint(
			"/hackkit/access/ban",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(await domain().users.getUserBan(await actor(ctx))),
		),
		getHackkitPrincipal: createAuthEndpoint(
			"/hackkit/access/principal",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().accessControl.getPrincipal(await actor(ctx)),
				),
		),
		checkHackkitPermission: createAuthEndpoint(
			"/hackkit/access/check",
			{
				method: "POST",
				body: body<{ permission: PermissionKey }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json({
					allowed: await domain().accessControl.hasPermission(
						await actor(ctx),
						ctx.body.permission,
					),
				}),
		),

		getHackkitSettingValue: createAuthEndpoint(
			"/hackkit/settings/value",
			{ method: "POST", body: body<{ key: SettingKey }>() },
			async (ctx) =>
				ctx.json({
					value: await domain().settings.getValue(ctx.body.key),
				}),
		),
		listHackkitSettings: createAuthEndpoint(
			"/hackkit/settings/list",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().settings.list({
						actorAuthId: await actor(ctx),
					}),
				),
		),
		setHackkitSetting: createAuthEndpoint(
			"/hackkit/settings/set",
			{
				method: "POST",
				body: body<{ key: SettingKey; value: unknown }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().settings.set({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		setManyHackkitSettings: createAuthEndpoint(
			"/hackkit/settings/set-many",
			{
				method: "POST",
				body: body<{ values: { key: SettingKey; value: unknown }[] }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().settings.setMany({
						values: ctx.body.values,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		resetHackkitSetting: createAuthEndpoint(
			"/hackkit/settings/reset",
			{
				method: "POST",
				body: body<{ key: SettingKey }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().settings.reset({
						key: ctx.body.key,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		resetManyHackkitSettings: createAuthEndpoint(
			"/hackkit/settings/reset-many",
			{
				method: "POST",
				body: body<{ keys: SettingKey[] }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().settings.resetMany({
						keys: ctx.body.keys,
						actorAuthId: await actor(ctx),
					}),
				),
		),

		claimHackkitTag: createAuthEndpoint(
			"/hackkit/profile/tag",
			{
				method: "POST",
				body: body<{ hackTag: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().users.claimHackTag({
						authId: await actor(ctx),
						hackTag: ctx.body.hackTag,
					}),
				),
		),
		updateHackkitProfile: createAuthEndpoint(
			"/hackkit/profile/update",
			{
				method: "POST",
				body: body<WithoutIdentity<UpdateUserProfileInput>>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().users.updateProfile({
						...ctx.body,
						authId: await actor(ctx),
					}),
				),
		),
		getHackkitPublicProfile: createAuthEndpoint(
			"/hackkit/profile/public",
			{ method: "POST", body: body<{ hackTag: string }>() },
			async (ctx) =>
				ctx.json(
					await domain().users.getPublicProfileByHackTag(
						ctx.body.hackTag,
					),
				),
		),
		approveHackkitUser: createAuthEndpoint(
			"/hackkit/users/approve",
			{
				method: "POST",
				body: body<{ targetAuthId: string; approved: boolean }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().users.approveUser({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		banHackkitUser: createAuthEndpoint(
			"/hackkit/users/ban",
			{
				method: "POST",
				body: body<{ targetAuthId: string; reason?: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().users.banUser({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		unbanHackkitUser: createAuthEndpoint(
			"/hackkit/users/unban",
			{
				method: "POST",
				body: body<{ targetAuthId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				await domain().users.unbanUser({
					...ctx.body,
					actorAuthId: await actor(ctx),
				});
				return ctx.json(ok);
			},
		),
		checkInHackkitUser: createAuthEndpoint(
			"/hackkit/users/check-in",
			{
				method: "POST",
				body: body<{ targetAuthId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().users.checkIn({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		clearHackkitUserCheckIn: createAuthEndpoint(
			"/hackkit/users/check-in/clear",
			{
				method: "POST",
				body: body<{ targetAuthId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().users.clearCheckIn({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),

		getHackkitUserData: createAuthEndpoint(
			"/hackkit/user-data",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(await domain().userData.getUserData(await actor(ctx))),
		),
		completeHackkitUserData: createAuthEndpoint(
			"/hackkit/user-data/complete",
			{
				method: "POST",
				body: body<WithoutIdentity<CompleteUserDataInput>>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().userData.completeUserData({
						...ctx.body,
						authId: await actor(ctx),
					}),
				),
		),
		getHackkitHacker: createAuthEndpoint(
			"/hackkit/hacker",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(await domain().hackers.getHacker(await actor(ctx))),
		),
		registerHackkitHacker: createAuthEndpoint(
			"/hackkit/hacker/register",
			{
				method: "POST",
				body: body<WithoutIdentity<RegisterHackerInput>>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().hackers.registerHacker({
						...ctx.body,
						authId: await actor(ctx),
					}),
				),
		),

		listHackkitGroups: createAuthEndpoint(
			"/hackkit/groups",
			{ method: "GET" },
			async (ctx) => ctx.json(domain().groups.listGroups()),
		),
		getHackkitGroup: createAuthEndpoint(
			"/hackkit/groups/current",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().groups.getGroupForAuthId(await actor(ctx)),
				),
		),
		assignHackkitGroup: createAuthEndpoint(
			"/hackkit/groups/assign",
			{
				method: "POST",
				body: body<{ targetAuthId: string; groupId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const actorAuthId = await actor(ctx);
				await domain().accessControl.requirePermission(
					actorAuthId,
					CorePermission.UsersApprove,
				);
				return ctx.json(
					await domain().groups.assignGroup({
						authId: ctx.body.targetAuthId,
						groupId: ctx.body.groupId,
					}),
				);
			},
		),

		getHackkitRsvpSummary: createAuthEndpoint(
			"/hackkit/rsvp/summary",
			{ method: "GET" },
			async (ctx) => ctx.json(await domain().rsvp.getSummary()),
		),
		getHackkitRsvp: createAuthEndpoint(
			"/hackkit/rsvp",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(await domain().rsvp.getRsvp(await actor(ctx))),
		),
		confirmHackkitRsvp: createAuthEndpoint(
			"/hackkit/rsvp/confirm",
			{ method: "POST", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().rsvp.confirm({ authId: await actor(ctx) }),
				),
		),
		listHackkitRsvps: createAuthEndpoint(
			"/hackkit/rsvp/list",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().rsvp.listRsvps({
						actorAuthId: await actor(ctx),
					}),
				),
		),
		cancelHackkitRsvp: createAuthEndpoint(
			"/hackkit/rsvp/cancel",
			{
				method: "POST",
				body: body<{ targetAuthId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().rsvp.cancel({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		setHackkitRsvpStatus: createAuthEndpoint(
			"/hackkit/rsvp/status",
			{
				method: "POST",
				body: body<{
					targetAuthId: string;
					status: "confirmed" | "waitlisted" | "cancelled";
				}>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().rsvp.setStatus({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		promoteHackkitRsvp: createAuthEndpoint(
			"/hackkit/rsvp/promote",
			{
				method: "POST",
				body: body<{ targetAuthId?: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().rsvp.promote({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),

		listHackkitRoles: createAuthEndpoint(
			"/hackkit/roles",
			{ method: "GET" },
			async (ctx) => ctx.json(await domain().roles.listRoles()),
		),
		getHackkitRole: createAuthEndpoint(
			"/hackkit/roles/get",
			{ method: "POST", body: body<{ roleId: string }>() },
			async (ctx) =>
				ctx.json(await domain().roles.getRole(ctx.body.roleId)),
		),
		createHackkitRole: createAuthEndpoint(
			"/hackkit/roles/create",
			{
				method: "POST",
				body: body<WithoutIdentity<CreateRoleInput>>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().roles.createRole({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		updateHackkitRole: createAuthEndpoint(
			"/hackkit/roles/update",
			{
				method: "POST",
				body: body<WithoutIdentity<UpdateRoleInput>>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().roles.updateRole({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		deleteHackkitRole: createAuthEndpoint(
			"/hackkit/roles/delete",
			{
				method: "POST",
				body: body<{ roleId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				await domain().roles.deleteRole({
					...ctx.body,
					actorAuthId: await actor(ctx),
				});
				return ctx.json(ok);
			},
		),
		assignHackkitRole: createAuthEndpoint(
			"/hackkit/roles/assign",
			{
				method: "POST",
				body: body<{ targetAuthId: string; roleId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().roles.assignRoleToUser({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),

		listHackkitEvents: createAuthEndpoint(
			"/hackkit/events",
			{ method: "GET" },
			async (ctx) => ctx.json(await domain().events.listEvents()),
		),
		listAllHackkitEvents: createAuthEndpoint(
			"/hackkit/events/all",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().events.listEvents({
						actorAuthId: await actor(ctx),
					}),
				),
		),
		getHackkitEvent: createAuthEndpoint(
			"/hackkit/events/get",
			{ method: "POST", body: body<{ eventId: string }>() },
			async (ctx) =>
				ctx.json(
					await domain().events.getEvent({
						eventId: ctx.body.eventId,
					}),
				),
		),
		getAnyHackkitEvent: createAuthEndpoint(
			"/hackkit/events/get-any",
			{
				method: "POST",
				body: body<{ eventId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().events.getEvent({
						eventId: ctx.body.eventId,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		createHackkitEvent: createAuthEndpoint(
			"/hackkit/events/create",
			{
				method: "POST",
				body: body<WithoutIdentity<CreateEventInput>>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().events.createEvent({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		updateHackkitEvent: createAuthEndpoint(
			"/hackkit/events/update",
			{
				method: "POST",
				body: body<WithoutIdentity<UpdateEventInput>>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().events.updateEvent({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		deleteHackkitEvent: createAuthEndpoint(
			"/hackkit/events/delete",
			{
				method: "POST",
				body: body<{ eventId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				await domain().events.deleteEvent({
					...ctx.body,
					actorAuthId: await actor(ctx),
				});
				return ctx.json(ok);
			},
		),
		listHackkitEventScans: createAuthEndpoint(
			"/hackkit/events/scans",
			{
				method: "POST",
				body: body<{ eventId: string; targetAuthId?: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().events.listEventScans({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		previewHackkitScan: createAuthEndpoint(
			"/hackkit/events/scans/preview",
			{
				method: "POST",
				body: body<{ eventId?: string; targetAuthId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const actorAuthId = await actor(ctx);
				await domain().accessControl.requirePermission(
					actorAuthId,
					ctx.body.eventId
						? CorePermission.EventsScan
						: CorePermission.UsersCheckIn,
				);
				const user = await domain().users.getUser(
					ctx.body.targetAuthId,
				);
				if (!user) throw new Error("User not found.");
				const priorScans = ctx.body.eventId
					? await domain().events.listEventScans({
							actorAuthId,
							eventId: ctx.body.eventId,
							targetAuthId: ctx.body.targetAuthId,
						})
					: [];
				return ctx.json({ user, priorScans });
			},
		),
		recordHackkitEventScan: createAuthEndpoint(
			"/hackkit/events/scans/record",
			{
				method: "POST",
				body: body<{ eventId: string; targetAuthId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().events.recordEventScan({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),

		getHackkitAdminOverview: createAuthEndpoint(
			"/hackkit/admin/overview",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().admin.getOverview({
						actorAuthId: await actor(ctx),
					}),
				),
		),
		listHackkitAdminUsers: createAuthEndpoint(
			"/hackkit/admin/users",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().admin.listUsers({
						actorAuthId: await actor(ctx),
					}),
				),
		),
		getHackkitAdminUser: createAuthEndpoint(
			"/hackkit/admin/users/get",
			{
				method: "POST",
				body: body<{ targetAuthId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await domain().admin.getUser({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		exportHackkitAdminUsers: createAuthEndpoint(
			"/hackkit/admin/users/export",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await domain().admin.exportUsers({
						actorAuthId: await actor(ctx),
					}),
				),
		),

		createHackkitTeam: createAuthEndpoint(
			"/hackkit/teams/create",
			{
				method: "POST",
				body: body<{ name: string; tag: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await plugin<TeamsEndpoints>("teams").createTeam({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		inviteToHackkitTeam: createAuthEndpoint(
			"/hackkit/teams/invite",
			{
				method: "POST",
				body: body<{
					teamId: string;
					inviteeAuthId?: string;
					hackTag?: string;
				}>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await plugin<TeamsEndpoints>("teams").inviteToTeam({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		respondToHackkitTeamInvite: createAuthEndpoint(
			"/hackkit/teams/invite/respond",
			{
				method: "POST",
				body: body<{ inviteId: string; accept: boolean }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await plugin<TeamsEndpoints>("teams").respondToInvite({
						...ctx.body,
						actorAuthId: await actor(ctx),
					}),
				),
		),
		leaveHackkitTeam: createAuthEndpoint(
			"/hackkit/teams/leave",
			{ method: "POST", use: [sessionMiddleware] },
			async (ctx) => {
				await plugin<TeamsEndpoints>("teams").leaveTeam({
					actorAuthId: await actor(ctx),
				});
				return ctx.json(ok);
			},
		),
		removeHackkitTeamMember: createAuthEndpoint(
			"/hackkit/teams/member/remove",
			{
				method: "POST",
				body: body<{ memberAuthId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				await plugin<TeamsEndpoints>("teams").removeMember({
					...ctx.body,
					actorAuthId: await actor(ctx),
				});
				return ctx.json(ok);
			},
		),
		getHackkitTeam: createAuthEndpoint(
			"/hackkit/teams/current",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await plugin<TeamsEndpoints>("teams").getTeamForAuthId(
						await actor(ctx),
					),
				),
		),
		listHackkitTeamMembers: createAuthEndpoint(
			"/hackkit/teams/members",
			{
				method: "POST",
				body: body<{ teamId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					(
						await plugin<TeamsEndpoints>("teams").listTeamMembers(
							ctx.body.teamId,
						)
					).map(({ user, ...member }) => ({
						...member,
						user: {
							authId: user.authId,
							hackTag: user.hackTag,
							firstName: user.firstName,
							lastName: user.lastName,
							profilePhotoUrl: user.profilePhotoUrl,
						},
					})),
				),
		),
		listPendingHackkitTeamInvites: createAuthEndpoint(
			"/hackkit/teams/invites/pending",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await plugin<TeamsEndpoints>("teams").listPendingInvites(
						await actor(ctx),
					),
				),
		),
		listHackkitTeamInvites: createAuthEndpoint(
			"/hackkit/teams/invites",
			{
				method: "POST",
				body: body<{ teamId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await plugin<TeamsEndpoints>("teams").listTeamInvites({
						teamId: ctx.body.teamId,
						actorAuthId: await actor(ctx),
					}),
				),
		),

		createHackkitDiscordVerification: createAuthEndpoint(
			"/hackkit/discord/verification/create",
			{
				method: "POST",
				body: body<CreateDiscordVerificationInput>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const actorAuthId = await actor(ctx);
				await domain().accessControl.requirePermission(
					actorAuthId,
					CorePermission.Admin,
				);
				return ctx.json(
					await plugin<DiscordEndpoints>(
						"discord",
					).createVerification(ctx.body),
				);
			},
		),
		getHackkitDiscordVerification: createAuthEndpoint(
			"/hackkit/discord/verification",
			{
				method: "POST",
				body: body<{ code: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				await actor(ctx);
				return ctx.json(
					await plugin<DiscordEndpoints>("discord").getVerification(
						ctx.body.code,
					),
				);
			},
		),
		getHackkitDiscordMember: createAuthEndpoint(
			"/hackkit/discord/member",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await plugin<DiscordEndpoints>("discord").getMember(
						await actor(ctx),
					),
				),
		),
		confirmHackkitDiscordVerification: createAuthEndpoint(
			"/hackkit/discord/verification/confirm",
			{
				method: "POST",
				body: body<{ code: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) =>
				ctx.json(
					await plugin<DiscordEndpoints>(
						"discord",
					).confirmVerification({
						code: ctx.body.code,
						authId: await actor(ctx),
					}),
				),
		),
		getHackkitDiscordRoleSyncPlan: createAuthEndpoint(
			"/hackkit/discord/roles/plan",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await plugin<DiscordEndpoints>("discord").buildRoleSyncPlan(
						{
							authId: await actor(ctx),
						},
					),
				),
		),
		syncHackkitDiscordRoles: createAuthEndpoint(
			"/hackkit/discord/roles/sync",
			{ method: "POST", use: [sessionMiddleware] },
			async (ctx) =>
				ctx.json(
					await plugin<DiscordEndpoints>("discord").syncMemberRoles({
						authId: await actor(ctx),
					}),
				),
		),

		deliverPendingHackkitEmailNotifications: createAuthEndpoint(
			"/hackkit/admin/email/deliver-pending",
			{
				method: "POST",
				body: body<{ limit?: number }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const actorAuthId = await actor(ctx);
				await domain().accessControl.requirePermission(
					actorAuthId,
					CorePermission.Admin,
				);
				return ctx.json(
					await plugin<EmailEndpoints>(
						"notificationsEmail",
					).deliverPending(ctx.body),
				);
			},
		),
		deliverHackkitEmailNotification: createAuthEndpoint(
			"/hackkit/admin/email/deliver",
			{
				method: "POST",
				body: body<{ intentId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const actorAuthId = await actor(ctx);
				await domain().accessControl.requirePermission(
					actorAuthId,
					CorePermission.Admin,
				);
				return ctx.json(
					await plugin<EmailEndpoints>(
						"notificationsEmail",
					).deliverIntent(ctx.body.intentId),
				);
			},
		),

		listHackkitNotificationIntents: createAuthEndpoint(
			"/hackkit/admin/notifications",
			{
				method: "POST",
				body: body<{
					status?: string;
					kind?: string;
					recipientAuthId?: string;
					limit?: number;
				}>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const actorAuthId = await actor(ctx);
				await domain().accessControl.requirePermission(
					actorAuthId,
					CorePermission.Admin,
				);
				return ctx.json(
					await domain().notifications.listIntents(ctx.body),
				);
			},
		),
		getHackkitNotificationIntent: createAuthEndpoint(
			"/hackkit/admin/notifications/get",
			{
				method: "POST",
				body: body<{ intentId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const actorAuthId = await actor(ctx);
				await domain().accessControl.requirePermission(
					actorAuthId,
					CorePermission.Admin,
				);
				return ctx.json(
					await domain().notifications.getIntent(ctx.body.intentId),
				);
			},
		),
		listHackkitNotificationDeliveryAttempts: createAuthEndpoint(
			"/hackkit/admin/notifications/delivery-attempts",
			{
				method: "POST",
				body: body<{ intentId: string }>(),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const actorAuthId = await actor(ctx);
				await domain().accessControl.requirePermission(
					actorAuthId,
					CorePermission.Admin,
				);
				return ctx.json(
					await domain().notifications.listDeliveryAttempts(
						ctx.body.intentId,
					),
				);
			},
		),
	};
}
