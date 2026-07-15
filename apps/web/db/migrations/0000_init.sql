CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `core_event` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`location` text DEFAULT 'TBD' NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`host` text,
	`hidden` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `core_event_startTime_idx` ON `core_event` (`startTime`);--> statement-breakpoint
CREATE INDEX `core_event_type_idx` ON `core_event` (`type`);--> statement-breakpoint
CREATE INDEX `core_event_hidden_idx` ON `core_event` (`hidden`);--> statement-breakpoint
CREATE TABLE `core_eventScan` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`authId` text NOT NULL,
	`scannedByAuthId` text NOT NULL,
	`scannedAt` integer NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `core_event`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scannedByAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `core_eventScan_eventId_idx` ON `core_eventScan` (`eventId`);--> statement-breakpoint
CREATE INDEX `core_eventScan_authId_idx` ON `core_eventScan` (`authId`);--> statement-breakpoint
CREATE INDEX `core_eventScan_eventId_authId_idx` ON `core_eventScan` (`eventId`,`authId`);--> statement-breakpoint
CREATE INDEX `core_eventScan_scannedAt_idx` ON `core_eventScan` (`scannedAt`);--> statement-breakpoint
CREATE TABLE `core_hacker` (
	`authId` text PRIMARY KEY NOT NULL,
	`university` text NOT NULL,
	`major` text NOT NULL,
	`schoolId` text,
	`levelOfStudy` text NOT NULL,
	`hackathonsAttended` integer NOT NULL,
	`softwareExperience` text NOT NULL,
	`heardFrom` text,
	`githubUrl` text,
	`linkedInUrl` text,
	`personalWebsiteUrl` text,
	`resumeUrl` text,
	`group` text,
	`registeredAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `core_hacker_registeredAt_idx` ON `core_hacker` (`registeredAt`);--> statement-breakpoint
CREATE TABLE `core_notificationDeliveryAttempt` (
	`id` text PRIMARY KEY NOT NULL,
	`intentId` text NOT NULL,
	`channel` text NOT NULL,
	`provider` text,
	`status` text NOT NULL,
	`recipient` text,
	`externalId` text,
	`error` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`attemptedAt` integer NOT NULL,
	FOREIGN KEY (`intentId`) REFERENCES `core_notificationIntent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `core_notificationDeliveryAttempt_intentId_idx` ON `core_notificationDeliveryAttempt` (`intentId`);--> statement-breakpoint
CREATE INDEX `core_notificationDeliveryAttempt_channel_idx` ON `core_notificationDeliveryAttempt` (`channel`);--> statement-breakpoint
CREATE INDEX `core_notificationDeliveryAttempt_status_idx` ON `core_notificationDeliveryAttempt` (`status`);--> statement-breakpoint
CREATE INDEX `core_notificationDeliveryAttempt_attemptedAt_idx` ON `core_notificationDeliveryAttempt` (`attemptedAt`);--> statement-breakpoint
CREATE TABLE `core_notificationIntent` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`recipientAuthId` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotencyKey` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`recipientAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_notificationIntent_idempotencyKey_unique` ON `core_notificationIntent` (`idempotencyKey`);--> statement-breakpoint
CREATE INDEX `core_notificationIntent_kind_idx` ON `core_notificationIntent` (`kind`);--> statement-breakpoint
CREATE INDEX `core_notificationIntent_recipientAuthId_idx` ON `core_notificationIntent` (`recipientAuthId`);--> statement-breakpoint
CREATE INDEX `core_notificationIntent_status_idx` ON `core_notificationIntent` (`status`);--> statement-breakpoint
CREATE INDEX `core_notificationIntent_createdAt_idx` ON `core_notificationIntent` (`createdAt`);--> statement-breakpoint
CREATE TABLE `core_role` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`color` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_role_name_unique` ON `core_role` (`name`);--> statement-breakpoint
CREATE INDEX `core_role_position_idx` ON `core_role` (`position`);--> statement-breakpoint
CREATE TABLE `core_rsvp` (
	`authId` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`waitlistPosition` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`confirmedAt` integer,
	`waitlistedAt` integer,
	`cancelledAt` integer,
	`cancelledByAuthId` text,
	`promotedAt` integer,
	`promotedByAuthId` text,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cancelledByAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`promotedByAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `core_rsvp_status_idx` ON `core_rsvp` (`status`);--> statement-breakpoint
CREATE INDEX `core_rsvp_waitlistPosition_idx` ON `core_rsvp` (`waitlistPosition`);--> statement-breakpoint
CREATE INDEX `core_rsvp_createdAt_idx` ON `core_rsvp` (`createdAt`);--> statement-breakpoint
CREATE INDEX `core_rsvp_updatedAt_idx` ON `core_rsvp` (`updatedAt`);--> statement-breakpoint
CREATE TABLE `core_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`createdAt` integer NOT NULL,
	`createdByAuthId` text,
	`updatedAt` integer NOT NULL,
	`updatedByAuthId` text,
	FOREIGN KEY (`createdByAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updatedByAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `core_setting_updatedAt_idx` ON `core_setting` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `core_setting_updatedByAuthId_idx` ON `core_setting` (`updatedByAuthId`);--> statement-breakpoint
CREATE TABLE `core_user` (
	`authId` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`firstName` text NOT NULL,
	`lastName` text NOT NULL,
	`profilePhotoUrl` text,
	`hackTag` text,
	`bio` text,
	`pronouns` text,
	`skills` text DEFAULT '[]' NOT NULL,
	`isProfileSearchable` integer DEFAULT true NOT NULL,
	`discordDisplayHandle` text,
	`roleId` text,
	`isApproved` integer DEFAULT false NOT NULL,
	`checkedInAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`roleId`) REFERENCES `core_role`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_user_email_unique` ON `core_user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `core_user_hackTag_unique` ON `core_user` (`hackTag`);--> statement-breakpoint
CREATE INDEX `core_user_email_idx` ON `core_user` (`email`);--> statement-breakpoint
CREATE INDEX `core_user_hackTag_idx` ON `core_user` (`hackTag`);--> statement-breakpoint
CREATE INDEX `core_user_roleId_idx` ON `core_user` (`roleId`);--> statement-breakpoint
CREATE INDEX `core_user_createdAt_idx` ON `core_user` (`createdAt`);--> statement-breakpoint
CREATE TABLE `core_userBan` (
	`authId` text PRIMARY KEY NOT NULL,
	`reason` text,
	`bannedByAuthId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bannedByAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `core_userData` (
	`authId` text PRIMARY KEY NOT NULL,
	`age` integer NOT NULL,
	`gender` text NOT NULL,
	`race` text NOT NULL,
	`ethnicity` text NOT NULL,
	`shirtSize` text NOT NULL,
	`dietaryRestrictions` text DEFAULT '[]' NOT NULL,
	`accommodationNote` text,
	`phoneNumber` text,
	`countryOfResidence` text,
	`hasAcceptedMLHCodeOfConduct` integer NOT NULL,
	`hasSharedDataWithMLH` integer NOT NULL,
	`isEmailable` integer NOT NULL,
	`completedAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `discord_member` (
	`authId` text PRIMARY KEY NOT NULL,
	`discordUserId` text NOT NULL,
	`guildId` text NOT NULL,
	`username` text NOT NULL,
	`avatarHash` text,
	`verifiedAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastRoleSyncAt` integer,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_member_discordUserId_unique` ON `discord_member` (`discordUserId`);--> statement-breakpoint
CREATE INDEX `discord_member_discordUserId_idx` ON `discord_member` (`discordUserId`);--> statement-breakpoint
CREATE INDEX `discord_member_guildId_idx` ON `discord_member` (`guildId`);--> statement-breakpoint
CREATE INDEX `discord_member_updatedAt_idx` ON `discord_member` (`updatedAt`);--> statement-breakpoint
CREATE TABLE `discord_roleSyncAttempt` (
	`id` text PRIMARY KEY NOT NULL,
	`authId` text NOT NULL,
	`discordUserId` text NOT NULL,
	`guildId` text NOT NULL,
	`status` text NOT NULL,
	`roleIds` text DEFAULT '[]' NOT NULL,
	`roleNames` text DEFAULT '[]' NOT NULL,
	`error` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `discord_roleSyncAttempt_authId_idx` ON `discord_roleSyncAttempt` (`authId`);--> statement-breakpoint
CREATE INDEX `discord_roleSyncAttempt_discordUserId_idx` ON `discord_roleSyncAttempt` (`discordUserId`);--> statement-breakpoint
CREATE INDEX `discord_roleSyncAttempt_status_idx` ON `discord_roleSyncAttempt` (`status`);--> statement-breakpoint
CREATE INDEX `discord_roleSyncAttempt_createdAt_idx` ON `discord_roleSyncAttempt` (`createdAt`);--> statement-breakpoint
CREATE TABLE `discord_verification` (
	`code` text PRIMARY KEY NOT NULL,
	`discordUserId` text NOT NULL,
	`guildId` text NOT NULL,
	`username` text NOT NULL,
	`avatarHash` text,
	`authId` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`acceptedAt` integer,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `discord_verification_discordUserId_idx` ON `discord_verification` (`discordUserId`);--> statement-breakpoint
CREATE INDEX `discord_verification_guildId_idx` ON `discord_verification` (`guildId`);--> statement-breakpoint
CREATE INDEX `discord_verification_authId_idx` ON `discord_verification` (`authId`);--> statement-breakpoint
CREATE INDEX `discord_verification_status_idx` ON `discord_verification` (`status`);--> statement-breakpoint
CREATE INDEX `discord_verification_createdAt_idx` ON `discord_verification` (`createdAt`);--> statement-breakpoint
CREATE TABLE `teams_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`inviteeAuthId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams_team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviteeAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `teams_invite_teamId_idx` ON `teams_invite` (`teamId`);--> statement-breakpoint
CREATE INDEX `teams_invite_inviteeAuthId_idx` ON `teams_invite` (`inviteeAuthId`);--> statement-breakpoint
CREATE INDEX `teams_invite_teamId_inviteeAuthId_idx` ON `teams_invite` (`teamId`,`inviteeAuthId`);--> statement-breakpoint
CREATE TABLE `teams_member` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`authId` text NOT NULL,
	`joinedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams_team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_member_authId_unique` ON `teams_member` (`authId`);--> statement-breakpoint
CREATE INDEX `teams_member_teamId_idx` ON `teams_member` (`teamId`);--> statement-breakpoint
CREATE INDEX `teams_member_authId_idx` ON `teams_member` (`authId`);--> statement-breakpoint
CREATE TABLE `teams_team` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tag` text NOT NULL,
	`ownerAuthId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`ownerAuthId`) REFERENCES `core_user`(`authId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_team_tag_unique` ON `teams_team` (`tag`);--> statement-breakpoint
CREATE INDEX `teams_team_tag_idx` ON `teams_team` (`tag`);--> statement-breakpoint
CREATE INDEX `teams_team_ownerAuthId_idx` ON `teams_team` (`ownerAuthId`);