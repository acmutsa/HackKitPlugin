import { defineSetting } from "@hackkit/core";
import type { HackKitPlugin } from "@hackkit/core";
import { createTeamsApi } from "./api.js";
import { teamsModels } from "./models.js";
import { TeamsPermission } from "./permissions.js";
import { TeamsSetting } from "./settings.js";

export function teamsPlugin(): HackKitPlugin<
	"teams",
	ReturnType<typeof createTeamsApi>
> {
	return {
		id: "teams",
		packageName: "@hackkit/plugin-teams",
		actionFactory: "createTeamsActions",
		actionNames: [
			"createTeam",
			"inviteToTeam",
			"respondToInvite",
			"leaveTeam",
			"removeMember",
		],
		entities: Object.values(teamsModels),
		settings: [
			defineSetting({
				key: TeamsSetting.MaximumTeamSize,
				type: "number",
				defaultValue: 4,
				integer: true,
				min: 0,
				unit: "members",
				label: "Maximum team size",
				description:
					"Maximum number of members allowed on one team. 0 means unlimited.",
				category: "Teams",
			}),
		],
		permissions: {
			TeamCreate: TeamsPermission.TeamCreate,
			InviteSend: TeamsPermission.InviteSend,
			InviteRespond: TeamsPermission.InviteRespond,
			TeamManage: TeamsPermission.TeamManage,
		},
		setup: createTeamsApi,
	};
}

export { createTeamsApi } from "./api.js";
export { teamsModels } from "./models.js";
export { TeamsPermission } from "./permissions.js";
export { TeamsSetting } from "./settings.js";
export type { Team, TeamInvite, TeamMember } from "./models.js";
export type {
	TeamsApi,
	TeamWithMembers,
	PendingTeamInvite,
	TeamInviteWithInvitee,
} from "./api.js";
export type { TeamsActions } from "./actions.js";
