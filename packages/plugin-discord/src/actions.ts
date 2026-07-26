export type ConfirmDiscordVerificationInput = {
	code: string;
};

export type DiscordActions = {
	confirmDiscordVerification(
		values: ConfirmDiscordVerificationInput,
	): Promise<unknown>;
	syncDiscordMemberRoles(): Promise<unknown>;
};
