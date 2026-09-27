import { Migration } from '@mikro-orm/migrations';

export class Migration20260927180400_initial extends Migration {

  override name = 'Migration20260927180400_initial';

  override up(): void | Promise<void> {
    this.addSql(`create table \`user\` (\`id\` text not null primary key, \`name\` text not null, \`email\` text not null, \`email_verified\` integer not null default false, \`image\` text null, \`created_at\` datetime not null, \`updated_at\` datetime not null);`);
    this.addSql(`create unique index \`user_email_unique\` on \`user\` (\`email\`);`);

    this.addSql(`create table \`session\` (\`id\` text not null primary key, \`expires_at\` datetime not null, \`token\` text not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`ip_address\` text null, \`user_agent\` text null, \`user_id\` text not null, constraint \`session_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on delete cascade);`);
    this.addSql(`create unique index \`session_token_unique\` on \`session\` (\`token\`);`);
    this.addSql(`create index \`session_user_id_index\` on \`session\` (\`user_id\`);`);

    this.addSql(`create table \`account\` (\`id\` text not null primary key, \`account_id\` text not null, \`provider_id\` text not null, \`user_id\` text not null, \`access_token\` text null, \`refresh_token\` text null, \`id_token\` text null, \`access_token_expires_at\` datetime null, \`refresh_token_expires_at\` datetime null, \`scope\` text null, \`password\` text null, \`created_at\` datetime not null, \`updated_at\` datetime not null, constraint \`account_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on delete cascade);`);
    this.addSql(`create index \`account_user_id_index\` on \`account\` (\`user_id\`);`);

    this.addSql(`create table \`verification\` (\`id\` text not null primary key, \`identifier\` text not null, \`value\` text not null, \`expires_at\` datetime not null, \`created_at\` datetime null, \`updated_at\` datetime null);`);
    this.addSql(`create index \`verification_identifier_index\` on \`verification\` (\`identifier\`);`);

    this.addSql(`create table \`core_event\` (\`id\` text not null primary key, \`title\` text not null, \`start_time\` datetime not null, \`end_time\` datetime not null, \`location\` text not null default 'TBD', \`description\` text not null, \`type\` text not null, \`host\` text null, \`hidden\` integer not null default false, \`created_at\` datetime not null, \`updated_at\` datetime not null);`);
    this.addSql(`create index \`core_event_start_time_index\` on \`core_event\` (\`start_time\`);`);
    this.addSql(`create index \`core_event_type_index\` on \`core_event\` (\`type\`);`);
    this.addSql(`create index \`core_event_hidden_index\` on \`core_event\` (\`hidden\`);`);

    this.addSql(`create table \`core_operation_lock\` (\`key\` text not null primary key, \`token\` text not null);`);

    this.addSql(`create table \`core_role\` (\`id\` text not null primary key, \`name\` text not null, \`position\` integer not null, \`permissions\` json not null default '[]', \`color\` text null, \`created_at\` datetime not null, \`updated_at\` datetime not null);`);
    this.addSql(`create unique index \`core_role_name_unique\` on \`core_role\` (\`name\`);`);
    this.addSql(`create index \`core_role_position_index\` on \`core_role\` (\`position\`);`);

    this.addSql(`create table \`core_user\` (\`auth_id\` text not null primary key, \`first_name\` text not null, \`last_name\` text not null, \`profile_photo_url\` text null, \`hack_tag\` text null, \`bio\` text null, \`pronouns\` text null, \`skills\` json not null default '[]', \`is_profile_searchable\` integer not null default true, \`discord_display_handle\` text null, \`role_id\` text null, \`is_approved\` integer not null default false, \`checked_in_at\` datetime null, \`created_at\` datetime not null, \`updated_at\` datetime not null, constraint \`core_user_auth_id_foreign\` foreign key (\`auth_id\`) references \`user\` (\`id\`) on update cascade on delete cascade, constraint \`core_user_role_id_foreign\` foreign key (\`role_id\`) references \`core_role\` (\`id\`) on delete set null);`);
    this.addSql(`create unique index \`core_user_hack_tag_unique\` on \`core_user\` (\`hack_tag\`);`);
    this.addSql(`create index \`core_user_hack_tag_index\` on \`core_user\` (\`hack_tag\`);`);
    this.addSql(`create index \`core_user_role_id_index\` on \`core_user\` (\`role_id\`);`);
    this.addSql(`create index \`core_user_created_at_index\` on \`core_user\` (\`created_at\`);`);

    this.addSql(`create table \`discord_verification\` (\`code\` text not null primary key, \`discord_user_id\` text not null, \`guild_id\` text not null, \`username\` text not null, \`avatar_hash\` text null, \`auth_id\` text null, \`status\` text check (\`status\` in ('pending', 'accepted', 'rejected', 'expired')) not null default 'pending', \`expires_at\` datetime not null, \`created_at\` datetime not null, \`accepted_at\` datetime null, constraint \`discord_verification_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on delete set null);`);
    this.addSql(`create index \`discord_verification_discord_user_id_index\` on \`discord_verification\` (\`discord_user_id\`);`);
    this.addSql(`create index \`discord_verification_guild_id_index\` on \`discord_verification\` (\`guild_id\`);`);
    this.addSql(`create index \`discord_verification_auth_id_index\` on \`discord_verification\` (\`auth_id\`);`);
    this.addSql(`create index \`discord_verification_status_index\` on \`discord_verification\` (\`status\`);`);
    this.addSql(`create index \`discord_verification_created_at_index\` on \`discord_verification\` (\`created_at\`);`);

    this.addSql(`create table \`discord_role_sync_attempt\` (\`id\` text not null primary key, \`auth_id\` text not null, \`discord_user_id\` text not null, \`guild_id\` text not null, \`status\` text check (\`status\` in ('synced', 'failed', 'skipped')) not null, \`role_ids\` json not null default '[]', \`role_names\` json not null default '[]', \`error\` text null, \`created_at\` datetime not null, constraint \`discord_role_sync_attempt_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on delete cascade);`);
    this.addSql(`create index \`discord_role_sync_attempt_auth_id_index\` on \`discord_role_sync_attempt\` (\`auth_id\`);`);
    this.addSql(`create index \`discord_role_sync_attempt_discord_user_id_index\` on \`discord_role_sync_attempt\` (\`discord_user_id\`);`);
    this.addSql(`create index \`discord_role_sync_attempt_status_index\` on \`discord_role_sync_attempt\` (\`status\`);`);
    this.addSql(`create index \`discord_role_sync_attempt_created_at_index\` on \`discord_role_sync_attempt\` (\`created_at\`);`);

    this.addSql(`create table \`discord_member\` (\`auth_id\` text not null primary key, \`discord_user_id\` text not null, \`guild_id\` text not null, \`username\` text not null, \`avatar_hash\` text null, \`verified_at\` datetime not null, \`updated_at\` datetime not null, \`last_role_sync_at\` datetime null, constraint \`discord_member_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on update cascade on delete cascade);`);
    this.addSql(`create index \`discord_member_auth_id_index\` on \`discord_member\` (\`auth_id\`);`);
    this.addSql(`create unique index \`discord_member_discord_user_id_unique\` on \`discord_member\` (\`discord_user_id\`);`);
    this.addSql(`create index \`discord_member_discord_user_id_index\` on \`discord_member\` (\`discord_user_id\`);`);
    this.addSql(`create index \`discord_member_guild_id_index\` on \`discord_member\` (\`guild_id\`);`);
    this.addSql(`create index \`discord_member_updated_at_index\` on \`discord_member\` (\`updated_at\`);`);

    this.addSql(`create table \`core_user_data\` (\`auth_id\` text not null primary key, \`age\` integer not null, \`gender\` text not null, \`race\` text not null, \`ethnicity\` text not null, \`shirt_size\` text not null, \`dietary_restrictions\` json not null default '[]', \`accommodation_note\` text null, \`phone_number\` text null, \`country_of_residence\` text null, \`has_accepted_mlhcode_of_conduct\` integer not null, \`has_shared_data_with_mlh\` integer not null, \`is_emailable\` integer not null, \`completed_at\` datetime not null, \`updated_at\` datetime not null, constraint \`core_user_data_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on update cascade on delete cascade);`);
    this.addSql(`create index \`core_user_data_auth_id_index\` on \`core_user_data\` (\`auth_id\`);`);

    this.addSql(`create table \`core_user_ban\` (\`auth_id\` text not null primary key, \`reason\` text null, \`banned_by_auth_id\` text not null, \`created_at\` datetime not null, constraint \`core_user_ban_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on update cascade on delete cascade, constraint \`core_user_ban_banned_by_auth_id_foreign\` foreign key (\`banned_by_auth_id\`) references \`core_user\` (\`auth_id\`));`);
    this.addSql(`create index \`core_user_ban_auth_id_index\` on \`core_user_ban\` (\`auth_id\`);`);
    this.addSql(`create index \`core_user_ban_banned_by_auth_id_index\` on \`core_user_ban\` (\`banned_by_auth_id\`);`);

    this.addSql(`create table \`core_setting\` (\`key\` text not null primary key, \`value\` json not null, \`created_at\` datetime not null, \`created_by_auth_id\` text null, \`updated_at\` datetime not null, \`updated_by_auth_id\` text null, constraint \`core_setting_created_by_auth_id_foreign\` foreign key (\`created_by_auth_id\`) references \`core_user\` (\`auth_id\`) on delete set null, constraint \`core_setting_updated_by_auth_id_foreign\` foreign key (\`updated_by_auth_id\`) references \`core_user\` (\`auth_id\`) on delete set null);`);
    this.addSql(`create index \`core_setting_created_by_auth_id_index\` on \`core_setting\` (\`created_by_auth_id\`);`);
    this.addSql(`create index \`core_setting_updated_at_index\` on \`core_setting\` (\`updated_at\`);`);
    this.addSql(`create index \`core_setting_updated_by_auth_id_index\` on \`core_setting\` (\`updated_by_auth_id\`);`);

    this.addSql(`create table \`core_rsvp\` (\`auth_id\` text not null primary key, \`status\` text check (\`status\` in ('confirmed', 'waitlisted', 'cancelled')) not null, \`waitlist_position\` integer null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`confirmed_at\` datetime null, \`waitlisted_at\` datetime null, \`cancelled_at\` datetime null, \`cancelled_by_auth_id\` text null, \`promoted_at\` datetime null, \`promoted_by_auth_id\` text null, constraint \`core_rsvp_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on update cascade on delete cascade, constraint \`core_rsvp_cancelled_by_auth_id_foreign\` foreign key (\`cancelled_by_auth_id\`) references \`core_user\` (\`auth_id\`) on delete set null, constraint \`core_rsvp_promoted_by_auth_id_foreign\` foreign key (\`promoted_by_auth_id\`) references \`core_user\` (\`auth_id\`) on delete set null);`);
    this.addSql(`create index \`core_rsvp_auth_id_index\` on \`core_rsvp\` (\`auth_id\`);`);
    this.addSql(`create index \`core_rsvp_cancelled_by_auth_id_index\` on \`core_rsvp\` (\`cancelled_by_auth_id\`);`);
    this.addSql(`create index \`core_rsvp_promoted_by_auth_id_index\` on \`core_rsvp\` (\`promoted_by_auth_id\`);`);
    this.addSql(`create index \`core_rsvp_status_index\` on \`core_rsvp\` (\`status\`);`);
    this.addSql(`create index \`core_rsvp_waitlist_position_index\` on \`core_rsvp\` (\`waitlist_position\`);`);
    this.addSql(`create index \`core_rsvp_created_at_index\` on \`core_rsvp\` (\`created_at\`);`);
    this.addSql(`create index \`core_rsvp_updated_at_index\` on \`core_rsvp\` (\`updated_at\`);`);

    this.addSql(`create table \`core_notification_intent\` (\`id\` text not null primary key, \`kind\` text not null, \`recipient_auth_id\` text null, \`payload\` json not null, \`status\` text check (\`status\` in ('pending', 'processing', 'delivered', 'failed', 'skipped')) not null default 'pending', \`idempotency_key\` text null, \`created_at\` datetime not null, \`updated_at\` datetime not null, constraint \`core_notification_intent_recipient_auth_id_foreign\` foreign key (\`recipient_auth_id\`) references \`core_user\` (\`auth_id\`) on delete set null);`);
    this.addSql(`create unique index \`core_notification_intent_idempotency_key_unique\` on \`core_notification_intent\` (\`idempotency_key\`);`);
    this.addSql(`create index \`core_notification_intent_kind_index\` on \`core_notification_intent\` (\`kind\`);`);
    this.addSql(`create index \`core_notification_intent_recipient_auth_id_index\` on \`core_notification_intent\` (\`recipient_auth_id\`);`);
    this.addSql(`create index \`core_notification_intent_status_index\` on \`core_notification_intent\` (\`status\`);`);
    this.addSql(`create index \`core_notification_intent_created_at_index\` on \`core_notification_intent\` (\`created_at\`);`);

    this.addSql(`create table \`core_notification_delivery_attempt\` (\`id\` text not null primary key, \`intent_id\` text not null, \`channel\` text not null, \`provider\` text null, \`status\` text check (\`status\` in ('delivered', 'failed', 'skipped')) not null, \`recipient\` text null, \`external_id\` text null, \`error\` text null, \`metadata\` json not null, \`attempted_at\` datetime not null, constraint \`core_notification_delivery_attempt_intent_id_foreign\` foreign key (\`intent_id\`) references \`core_notification_intent\` (\`id\`) on delete cascade);`);
    this.addSql(`create index \`core_notification_delivery_attempt_intent_id_index\` on \`core_notification_delivery_attempt\` (\`intent_id\`);`);
    this.addSql(`create index \`core_notification_delivery_attempt_channel_index\` on \`core_notification_delivery_attempt\` (\`channel\`);`);
    this.addSql(`create index \`core_notification_delivery_attempt_status_index\` on \`core_notification_delivery_attempt\` (\`status\`);`);
    this.addSql(`create index \`core_notification_delivery_attempt_attempted_at_index\` on \`core_notification_delivery_attempt\` (\`attempted_at\`);`);

    this.addSql(`create table \`core_hacker\` (\`auth_id\` text not null primary key, \`university\` text not null, \`major\` text not null, \`school_id\` text null, \`level_of_study\` text not null, \`hackathons_attended\` integer not null, \`software_experience\` text not null, \`heard_from\` text null, \`github_url\` text null, \`linked_in_url\` text null, \`personal_website_url\` text null, \`resume_url\` text null, \`group\` text null, \`registered_at\` datetime not null, \`updated_at\` datetime not null, constraint \`core_hacker_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on update cascade on delete cascade);`);
    this.addSql(`create index \`core_hacker_auth_id_index\` on \`core_hacker\` (\`auth_id\`);`);
    this.addSql(`create index \`core_hacker_registered_at_index\` on \`core_hacker\` (\`registered_at\`);`);

    this.addSql(`create table \`core_event_scan\` (\`id\` text not null primary key, \`event_id\` text not null, \`auth_id\` text not null, \`scanned_by_auth_id\` text not null, \`scanned_at\` datetime not null, constraint \`core_event_scan_event_id_foreign\` foreign key (\`event_id\`) references \`core_event\` (\`id\`) on delete cascade, constraint \`core_event_scan_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on delete cascade, constraint \`core_event_scan_scanned_by_auth_id_foreign\` foreign key (\`scanned_by_auth_id\`) references \`core_user\` (\`auth_id\`));`);
    this.addSql(`create index \`core_event_scan_scanned_by_auth_id_index\` on \`core_event_scan\` (\`scanned_by_auth_id\`);`);
    this.addSql(`create index \`core_event_scan_event_id_index\` on \`core_event_scan\` (\`event_id\`);`);
    this.addSql(`create index \`core_event_scan_auth_id_index\` on \`core_event_scan\` (\`auth_id\`);`);
    this.addSql(`create index \`core_event_scan_event_id_auth_id_index\` on \`core_event_scan\` (\`event_id\`, \`auth_id\`);`);
    this.addSql(`create index \`core_event_scan_scanned_at_index\` on \`core_event_scan\` (\`scanned_at\`);`);

    this.addSql(`create table \`teams_team\` (\`id\` text not null primary key, \`name\` text not null, \`tag\` text not null, \`owner_auth_id\` text not null, \`created_at\` datetime not null, constraint \`teams_team_owner_auth_id_foreign\` foreign key (\`owner_auth_id\`) references \`core_user\` (\`auth_id\`) on delete cascade);`);
    this.addSql(`create unique index \`teams_team_tag_unique\` on \`teams_team\` (\`tag\`);`);
    this.addSql(`create index \`teams_team_tag_index\` on \`teams_team\` (\`tag\`);`);
    this.addSql(`create index \`teams_team_owner_auth_id_index\` on \`teams_team\` (\`owner_auth_id\`);`);

    this.addSql(`create table \`teams_member\` (\`id\` text not null primary key, \`team_id\` text not null, \`auth_id\` text not null, \`joined_at\` datetime not null, constraint \`teams_member_team_id_foreign\` foreign key (\`team_id\`) references \`teams_team\` (\`id\`) on delete cascade, constraint \`teams_member_auth_id_foreign\` foreign key (\`auth_id\`) references \`core_user\` (\`auth_id\`) on delete cascade);`);
    this.addSql(`create unique index \`teams_member_auth_id_unique\` on \`teams_member\` (\`auth_id\`);`);
    this.addSql(`create index \`teams_member_team_id_index\` on \`teams_member\` (\`team_id\`);`);
    this.addSql(`create index \`teams_member_auth_id_index\` on \`teams_member\` (\`auth_id\`);`);

    this.addSql(`create table \`teams_invite\` (\`id\` text not null primary key, \`team_id\` text not null, \`invitee_auth_id\` text not null, \`status\` text check (\`status\` in ('pending', 'accepted', 'declined')) not null default 'pending', \`created_at\` datetime not null, constraint \`teams_invite_team_id_foreign\` foreign key (\`team_id\`) references \`teams_team\` (\`id\`) on delete cascade, constraint \`teams_invite_invitee_auth_id_foreign\` foreign key (\`invitee_auth_id\`) references \`core_user\` (\`auth_id\`) on delete cascade);`);
    this.addSql(`create index \`teams_invite_team_id_index\` on \`teams_invite\` (\`team_id\`);`);
    this.addSql(`create index \`teams_invite_invitee_auth_id_index\` on \`teams_invite\` (\`invitee_auth_id\`);`);
    this.addSql(`create index \`teams_invite_team_id_invitee_auth_id_index\` on \`teams_invite\` (\`team_id\`, \`invitee_auth_id\`);`);
  }

  override down(): void | Promise<void> {

    this.addSql(`drop table if exists \`user\`;`);
    this.addSql(`drop table if exists \`session\`;`);
    this.addSql(`drop table if exists \`account\`;`);
    this.addSql(`drop table if exists \`verification\`;`);
    this.addSql(`drop table if exists \`core_event\`;`);
    this.addSql(`drop table if exists \`core_operation_lock\`;`);
    this.addSql(`drop table if exists \`core_role\`;`);
    this.addSql(`drop table if exists \`core_user\`;`);
    this.addSql(`drop table if exists \`discord_verification\`;`);
    this.addSql(`drop table if exists \`discord_role_sync_attempt\`;`);
    this.addSql(`drop table if exists \`discord_member\`;`);
    this.addSql(`drop table if exists \`core_user_data\`;`);
    this.addSql(`drop table if exists \`core_user_ban\`;`);
    this.addSql(`drop table if exists \`core_setting\`;`);
    this.addSql(`drop table if exists \`core_rsvp\`;`);
    this.addSql(`drop table if exists \`core_notification_intent\`;`);
    this.addSql(`drop table if exists \`core_notification_delivery_attempt\`;`);
    this.addSql(`drop table if exists \`core_hacker\`;`);
    this.addSql(`drop table if exists \`core_event_scan\`;`);
    this.addSql(`drop table if exists \`teams_team\`;`);
    this.addSql(`drop table if exists \`teams_member\`;`);
    this.addSql(`drop table if exists \`teams_invite\`;`);
  }

}
