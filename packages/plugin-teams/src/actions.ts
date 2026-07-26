export type CreateTeamInput = {
	name: string;
	tag: string;
};

export type InviteToTeamInput = {
	teamId: string;
	hackTag: string;
};

export type RespondToInviteInput = {
	inviteId: string;
	accept: boolean;
};

export type RemoveMemberInput = {
	memberAuthId: string;
};

export type TeamsActions = {
	createTeam(values: CreateTeamInput): Promise<unknown>;
	inviteToTeam(values: InviteToTeamInput): Promise<unknown>;
	respondToInvite(values: RespondToInviteInput): Promise<unknown>;
	leaveTeam(): Promise<unknown>;
	removeMember(values: RemoveMemberInput): Promise<unknown>;
};
