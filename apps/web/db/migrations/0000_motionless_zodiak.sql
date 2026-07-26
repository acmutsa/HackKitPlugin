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
CREATE TABLE `core_event` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`location` text DEFAULT 'TBD' NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`host` text,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `coreEvent_startTime_idx` ON `core_event` (`start_time`);--> statement-breakpoint
CREATE INDEX `coreEvent_type_idx` ON `core_event` (`type`);--> statement-breakpoint
CREATE INDEX `coreEvent_hidden_idx` ON `core_event` (`hidden`);--> statement-breakpoint
CREATE TABLE `core_event_scan` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`auth_id` text NOT NULL,
	`scanned_by_auth_id` text NOT NULL,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `core_event`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scanned_by_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coreEventScan_eventId_idx` ON `core_event_scan` (`event_id`);--> statement-breakpoint
CREATE INDEX `coreEventScan_authId_idx` ON `core_event_scan` (`auth_id`);--> statement-breakpoint
CREATE INDEX `coreEventScan_scannedAt_idx` ON `core_event_scan` (`scanned_at`);--> statement-breakpoint
CREATE TABLE `core_hacker` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text NOT NULL,
	`university` text NOT NULL,
	`major` text NOT NULL,
	`school_id` text,
	`level_of_study` text NOT NULL,
	`hackathons_attended` integer NOT NULL,
	`software_experience` text NOT NULL,
	`heard_from` text,
	`github_url` text,
	`linked_in_url` text,
	`personal_website_url` text,
	`resume_url` text,
	`group` text,
	`registered_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_hacker_auth_id_unique` ON `core_hacker` (`auth_id`);--> statement-breakpoint
CREATE INDEX `coreHacker_registeredAt_idx` ON `core_hacker` (`registered_at`);--> statement-breakpoint
CREATE TABLE `core_notification_delivery_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`channel` text NOT NULL,
	`provider` text,
	`status` text NOT NULL,
	`recipient` text,
	`external_id` text,
	`error` text,
	`metadata` text NOT NULL,
	`attempted_at` integer NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `core_notification_intent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coreNotificationDeliveryAttempt_intentId_idx` ON `core_notification_delivery_attempt` (`intent_id`);--> statement-breakpoint
CREATE INDEX `coreNotificationDeliveryAttempt_channel_idx` ON `core_notification_delivery_attempt` (`channel`);--> statement-breakpoint
CREATE INDEX `coreNotificationDeliveryAttempt_status_idx` ON `core_notification_delivery_attempt` (`status`);--> statement-breakpoint
CREATE INDEX `coreNotificationDeliveryAttempt_attemptedAt_idx` ON `core_notification_delivery_attempt` (`attempted_at`);--> statement-breakpoint
CREATE TABLE `core_notification_intent` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`recipient_auth_id` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotency_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`recipient_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_notification_intent_idempotency_key_unique` ON `core_notification_intent` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `coreNotificationIntent_kind_idx` ON `core_notification_intent` (`kind`);--> statement-breakpoint
CREATE INDEX `coreNotificationIntent_recipientAuthId_idx` ON `core_notification_intent` (`recipient_auth_id`);--> statement-breakpoint
CREATE INDEX `coreNotificationIntent_status_idx` ON `core_notification_intent` (`status`);--> statement-breakpoint
CREATE INDEX `coreNotificationIntent_createdAt_idx` ON `core_notification_intent` (`created_at`);--> statement-breakpoint
CREATE TABLE `core_role` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`permissions` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_role_name_unique` ON `core_role` (`name`);--> statement-breakpoint
CREATE INDEX `coreRole_position_idx` ON `core_role` (`position`);--> statement-breakpoint
CREATE TABLE `core_rsvp` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text NOT NULL,
	`status` text NOT NULL,
	`waitlist_position` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`confirmed_at` integer,
	`waitlisted_at` integer,
	`cancelled_at` integer,
	`cancelled_by_auth_id` text,
	`promoted_at` integer,
	`promoted_by_auth_id` text,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cancelled_by_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`promoted_by_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_rsvp_auth_id_unique` ON `core_rsvp` (`auth_id`);--> statement-breakpoint
CREATE INDEX `coreRsvp_status_idx` ON `core_rsvp` (`status`);--> statement-breakpoint
CREATE INDEX `coreRsvp_waitlistPosition_idx` ON `core_rsvp` (`waitlist_position`);--> statement-breakpoint
CREATE INDEX `coreRsvp_createdAt_idx` ON `core_rsvp` (`created_at`);--> statement-breakpoint
CREATE INDEX `coreRsvp_updatedAt_idx` ON `core_rsvp` (`updated_at`);--> statement-breakpoint
CREATE TABLE `core_setting` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_auth_id` text,
	`updated_at` integer NOT NULL,
	`updated_by_auth_id` text,
	FOREIGN KEY (`created_by_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_setting_key_unique` ON `core_setting` (`key`);--> statement-breakpoint
CREATE INDEX `coreSetting_updatedAt_idx` ON `core_setting` (`updated_at`);--> statement-breakpoint
CREATE INDEX `coreSetting_updatedByAuthId_idx` ON `core_setting` (`updated_by_auth_id`);--> statement-breakpoint
CREATE TABLE `core_user_ban` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text NOT NULL,
	`reason` text,
	`banned_by_auth_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`banned_by_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_user_ban_auth_id_unique` ON `core_user_ban` (`auth_id`);--> statement-breakpoint
CREATE TABLE `core_user_data` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text NOT NULL,
	`age` integer NOT NULL,
	`gender` text NOT NULL,
	`race` text NOT NULL,
	`ethnicity` text NOT NULL,
	`shirt_size` text NOT NULL,
	`dietary_restrictions` text NOT NULL,
	`accommodation_note` text,
	`phone_number` text,
	`country_of_residence` text,
	`has_accepted_mlh_code_of_conduct` integer NOT NULL,
	`has_shared_data_with_mlh` integer NOT NULL,
	`is_emailable` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_user_data_auth_id_unique` ON `core_user_data` (`auth_id`);--> statement-breakpoint
CREATE TABLE `discord_member` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text NOT NULL,
	`discord_user_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`username` text NOT NULL,
	`avatar_hash` text,
	`verified_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_role_sync_at` integer,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_member_auth_id_unique` ON `discord_member` (`auth_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `discord_member_discord_user_id_unique` ON `discord_member` (`discord_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `discordMember_discordUserId_uidx` ON `discord_member` (`discord_user_id`);--> statement-breakpoint
CREATE INDEX `discordMember_guildId_idx` ON `discord_member` (`guild_id`);--> statement-breakpoint
CREATE INDEX `discordMember_updatedAt_idx` ON `discord_member` (`updated_at`);--> statement-breakpoint
CREATE TABLE `discord_role_sync_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text NOT NULL,
	`discord_user_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`status` text NOT NULL,
	`role_ids` text NOT NULL,
	`role_names` text NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `discordRoleSyncAttempt_authId_idx` ON `discord_role_sync_attempt` (`auth_id`);--> statement-breakpoint
CREATE INDEX `discordRoleSyncAttempt_discordUserId_idx` ON `discord_role_sync_attempt` (`discord_user_id`);--> statement-breakpoint
CREATE INDEX `discordRoleSyncAttempt_status_idx` ON `discord_role_sync_attempt` (`status`);--> statement-breakpoint
CREATE INDEX `discordRoleSyncAttempt_createdAt_idx` ON `discord_role_sync_attempt` (`created_at`);--> statement-breakpoint
CREATE TABLE `discord_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`discord_user_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`username` text NOT NULL,
	`avatar_hash` text,
	`auth_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_verification_code_unique` ON `discord_verification` (`code`);--> statement-breakpoint
CREATE INDEX `discordVerification_discordUserId_idx` ON `discord_verification` (`discord_user_id`);--> statement-breakpoint
CREATE INDEX `discordVerification_guildId_idx` ON `discord_verification` (`guild_id`);--> statement-breakpoint
CREATE INDEX `discordVerification_authId_idx` ON `discord_verification` (`auth_id`);--> statement-breakpoint
CREATE INDEX `discordVerification_status_idx` ON `discord_verification` (`status`);--> statement-breakpoint
CREATE INDEX `discordVerification_createdAt_idx` ON `discord_verification` (`created_at`);--> statement-breakpoint
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
CREATE TABLE `teams_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`invitee_auth_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams_team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `teamsInvite_teamId_idx` ON `teams_invite` (`team_id`);--> statement-breakpoint
CREATE INDEX `teamsInvite_inviteeAuthId_idx` ON `teams_invite` (`invitee_auth_id`);--> statement-breakpoint
CREATE TABLE `teams_member` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`auth_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams_team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_member_auth_id_unique` ON `teams_member` (`auth_id`);--> statement-breakpoint
CREATE INDEX `teamsMember_teamId_idx` ON `teams_member` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teamsMember_authId_uidx` ON `teams_member` (`auth_id`);--> statement-breakpoint
CREATE TABLE `teams_team` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tag` text NOT NULL,
	`owner_auth_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_auth_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_team_tag_unique` ON `teams_team` (`tag`);--> statement-breakpoint
CREATE UNIQUE INDEX `teamsTeam_tag_uidx` ON `teams_team` (`tag`);--> statement-breakpoint
CREATE INDEX `teamsTeam_ownerAuthId_idx` ON `teams_team` (`owner_auth_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`first_name` text,
	`last_name` text,
	`hack_tag` text,
	`bio` text,
	`pronouns` text,
	`skills` text,
	`is_profile_searchable` integer DEFAULT true NOT NULL,
	`discord_display_handle` text,
	`role_id` text,
	`is_approved` integer DEFAULT false NOT NULL,
	`checked_in_at` integer,
	FOREIGN KEY (`role_id`) REFERENCES `core_role`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_hack_tag_unique` ON `user` (`hack_tag`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_hackTag_uidx` ON `user` (`hack_tag`);--> statement-breakpoint
CREATE INDEX `user_roleId_idx` ON `user` (`role_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
--> statement-breakpoint
INSERT INTO `core_role` (`id`, `name`, `position`, `permissions`, `created_at`, `updated_at`)
VALUES
	('core.participant', 'Participant', 10, '[]', unixepoch() * 1000, unixepoch() * 1000),
	('core.owner', 'Owner', 0, '["core.super_admin"]', unixepoch() * 1000, unixepoch() * 1000);
--> statement-breakpoint
CREATE INDEX `coreEventScan_eventId_authId_idx` ON `core_event_scan` (`event_id`, `auth_id`);
--> statement-breakpoint
CREATE INDEX `teamsInvite_teamId_inviteeAuthId_idx` ON `teams_invite` (`team_id`, `invitee_auth_id`);
