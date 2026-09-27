import { Migration } from '@mikro-orm/migrations';

export class Migration20260927180400_initial extends Migration {

  override name = 'Migration20260927180400_initial';

  override up(): void | Promise<void> {
    this.addSql(`create table "user" ("id" varchar(255) not null, "name" varchar(255) not null, "email" varchar(255) not null, "email_verified" boolean not null default false, "image" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "user" add constraint "user_email_unique" unique ("email");`);

    this.addSql(`create table "session" ("id" varchar(255) not null, "expires_at" timestamptz not null, "token" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "ip_address" varchar(255) null, "user_agent" text null, "user_id" varchar(255) not null, primary key ("id"));`);
    this.addSql(`alter table "session" add constraint "session_token_unique" unique ("token");`);
    this.addSql(`create index "session_user_id_index" on "session" ("user_id");`);

    this.addSql(`create table "account" ("id" varchar(255) not null, "account_id" varchar(255) not null, "provider_id" varchar(255) not null, "user_id" varchar(255) not null, "access_token" text null, "refresh_token" text null, "id_token" text null, "access_token_expires_at" timestamptz null, "refresh_token_expires_at" timestamptz null, "scope" text null, "password" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "account_user_id_index" on "account" ("user_id");`);

    this.addSql(`create table "verification" ("id" varchar(255) not null, "identifier" varchar(255) not null, "value" text not null, "expires_at" timestamptz not null, "created_at" timestamptz null, "updated_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "verification_identifier_index" on "verification" ("identifier");`);

    this.addSql(`create table "core_event" ("id" varchar(255) not null, "title" varchar(255) not null, "start_time" timestamptz not null, "end_time" timestamptz not null, "location" varchar(255) not null default 'TBD', "description" text not null, "type" varchar(255) not null, "host" varchar(255) null, "hidden" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "core_event_start_time_index" on "core_event" ("start_time");`);
    this.addSql(`create index "core_event_type_index" on "core_event" ("type");`);
    this.addSql(`create index "core_event_hidden_index" on "core_event" ("hidden");`);

    this.addSql(`create table "core_operation_lock" ("key" varchar(255) not null, "token" varchar(255) not null, primary key ("key"));`);

    this.addSql(`create table "core_role" ("id" varchar(255) not null, "name" varchar(255) not null, "position" int not null, "permissions" jsonb not null default '[]', "color" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "core_role" add constraint "core_role_name_unique" unique ("name");`);
    this.addSql(`create index "core_role_position_index" on "core_role" ("position");`);

    this.addSql(`create table "core_user" ("auth_id" varchar(255) not null, "first_name" varchar(255) not null, "last_name" varchar(255) not null, "profile_photo_url" text null, "hack_tag" varchar(255) null, "bio" text null, "pronouns" varchar(255) null, "skills" jsonb not null default '[]', "is_profile_searchable" boolean not null default true, "discord_display_handle" varchar(255) null, "role_id" varchar(255) null, "is_approved" boolean not null default false, "checked_in_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("auth_id"));`);
    this.addSql(`alter table "core_user" add constraint "core_user_hack_tag_unique" unique ("hack_tag");`);
    this.addSql(`create index "core_user_hack_tag_index" on "core_user" ("hack_tag");`);
    this.addSql(`create index "core_user_role_id_index" on "core_user" ("role_id");`);
    this.addSql(`create index "core_user_created_at_index" on "core_user" ("created_at");`);

    this.addSql(`create table "discord_verification" ("code" varchar(255) not null, "discord_user_id" varchar(255) not null, "guild_id" varchar(255) not null, "username" varchar(255) not null, "avatar_hash" varchar(255) null, "auth_id" varchar(255) null, "status" text not null default 'pending', "expires_at" timestamptz not null, "created_at" timestamptz not null, "accepted_at" timestamptz null, primary key ("code"));`);
    this.addSql(`create index "discord_verification_discord_user_id_index" on "discord_verification" ("discord_user_id");`);
    this.addSql(`create index "discord_verification_guild_id_index" on "discord_verification" ("guild_id");`);
    this.addSql(`create index "discord_verification_auth_id_index" on "discord_verification" ("auth_id");`);
    this.addSql(`create index "discord_verification_status_index" on "discord_verification" ("status");`);
    this.addSql(`create index "discord_verification_created_at_index" on "discord_verification" ("created_at");`);

    this.addSql(`create table "discord_role_sync_attempt" ("id" varchar(255) not null, "auth_id" varchar(255) not null, "discord_user_id" varchar(255) not null, "guild_id" varchar(255) not null, "status" text not null, "role_ids" jsonb not null default '[]', "role_names" jsonb not null default '[]', "error" text null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "discord_role_sync_attempt_auth_id_index" on "discord_role_sync_attempt" ("auth_id");`);
    this.addSql(`create index "discord_role_sync_attempt_discord_user_id_index" on "discord_role_sync_attempt" ("discord_user_id");`);
    this.addSql(`create index "discord_role_sync_attempt_status_index" on "discord_role_sync_attempt" ("status");`);
    this.addSql(`create index "discord_role_sync_attempt_created_at_index" on "discord_role_sync_attempt" ("created_at");`);

    this.addSql(`create table "discord_member" ("auth_id" varchar(255) not null, "discord_user_id" varchar(255) not null, "guild_id" varchar(255) not null, "username" varchar(255) not null, "avatar_hash" varchar(255) null, "verified_at" timestamptz not null, "updated_at" timestamptz not null, "last_role_sync_at" timestamptz null, primary key ("auth_id"));`);
    this.addSql(`alter table "discord_member" add constraint "discord_member_discord_user_id_unique" unique ("discord_user_id");`);
    this.addSql(`create index "discord_member_discord_user_id_index" on "discord_member" ("discord_user_id");`);
    this.addSql(`create index "discord_member_guild_id_index" on "discord_member" ("guild_id");`);
    this.addSql(`create index "discord_member_updated_at_index" on "discord_member" ("updated_at");`);

    this.addSql(`create table "core_user_data" ("auth_id" varchar(255) not null, "age" int not null, "gender" varchar(255) not null, "race" varchar(255) not null, "ethnicity" varchar(255) not null, "shirt_size" varchar(255) not null, "dietary_restrictions" jsonb not null default '[]', "accommodation_note" text null, "phone_number" varchar(255) null, "country_of_residence" varchar(255) null, "has_accepted_mlhcode_of_conduct" boolean not null, "has_shared_data_with_mlh" boolean not null, "is_emailable" boolean not null, "completed_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("auth_id"));`);

    this.addSql(`create table "core_user_ban" ("auth_id" varchar(255) not null, "reason" varchar(255) null, "banned_by_auth_id" varchar(255) not null, "created_at" timestamptz not null, primary key ("auth_id"));`);

    this.addSql(`create table "core_setting" ("key" varchar(255) not null, "value" jsonb not null, "created_at" timestamptz not null, "created_by_auth_id" varchar(255) null, "updated_at" timestamptz not null, "updated_by_auth_id" varchar(255) null, primary key ("key"));`);
    this.addSql(`create index "core_setting_updated_at_index" on "core_setting" ("updated_at");`);
    this.addSql(`create index "core_setting_updated_by_auth_id_index" on "core_setting" ("updated_by_auth_id");`);

    this.addSql(`create table "core_rsvp" ("auth_id" varchar(255) not null, "status" text not null, "waitlist_position" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "confirmed_at" timestamptz null, "waitlisted_at" timestamptz null, "cancelled_at" timestamptz null, "cancelled_by_auth_id" varchar(255) null, "promoted_at" timestamptz null, "promoted_by_auth_id" varchar(255) null, primary key ("auth_id"));`);
    this.addSql(`create index "core_rsvp_status_index" on "core_rsvp" ("status");`);
    this.addSql(`create index "core_rsvp_waitlist_position_index" on "core_rsvp" ("waitlist_position");`);
    this.addSql(`create index "core_rsvp_created_at_index" on "core_rsvp" ("created_at");`);
    this.addSql(`create index "core_rsvp_updated_at_index" on "core_rsvp" ("updated_at");`);

    this.addSql(`create table "core_notification_intent" ("id" varchar(255) not null, "kind" varchar(255) not null, "recipient_auth_id" varchar(255) null, "payload" jsonb not null, "status" text not null default 'pending', "idempotency_key" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "core_notification_intent" add constraint "core_notification_intent_idempotency_key_unique" unique ("idempotency_key");`);
    this.addSql(`create index "core_notification_intent_kind_index" on "core_notification_intent" ("kind");`);
    this.addSql(`create index "core_notification_intent_recipient_auth_id_index" on "core_notification_intent" ("recipient_auth_id");`);
    this.addSql(`create index "core_notification_intent_status_index" on "core_notification_intent" ("status");`);
    this.addSql(`create index "core_notification_intent_created_at_index" on "core_notification_intent" ("created_at");`);

    this.addSql(`create table "core_notification_delivery_attempt" ("id" varchar(255) not null, "intent_id" varchar(255) not null, "channel" varchar(255) not null, "provider" varchar(255) null, "status" text not null, "recipient" varchar(255) null, "external_id" varchar(255) null, "error" text null, "metadata" jsonb not null, "attempted_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "core_notification_delivery_attempt_intent_id_index" on "core_notification_delivery_attempt" ("intent_id");`);
    this.addSql(`create index "core_notification_delivery_attempt_channel_index" on "core_notification_delivery_attempt" ("channel");`);
    this.addSql(`create index "core_notification_delivery_attempt_status_index" on "core_notification_delivery_attempt" ("status");`);
    this.addSql(`create index "core_notification_delivery_attempt_attempted_at_index" on "core_notification_delivery_attempt" ("attempted_at");`);

    this.addSql(`create table "core_hacker" ("auth_id" varchar(255) not null, "university" varchar(255) not null, "major" varchar(255) not null, "school_id" varchar(255) null, "level_of_study" varchar(255) not null, "hackathons_attended" int not null, "software_experience" varchar(255) not null, "heard_from" varchar(255) null, "github_url" text null, "linked_in_url" text null, "personal_website_url" text null, "resume_url" text null, "group" varchar(255) null, "registered_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("auth_id"));`);
    this.addSql(`create index "core_hacker_registered_at_index" on "core_hacker" ("registered_at");`);

    this.addSql(`create table "core_event_scan" ("id" varchar(255) not null, "event_id" varchar(255) not null, "auth_id" varchar(255) not null, "scanned_by_auth_id" varchar(255) not null, "scanned_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "core_event_scan_event_id_index" on "core_event_scan" ("event_id");`);
    this.addSql(`create index "core_event_scan_auth_id_index" on "core_event_scan" ("auth_id");`);
    this.addSql(`create index "core_event_scan_event_id_auth_id_index" on "core_event_scan" ("event_id", "auth_id");`);
    this.addSql(`create index "core_event_scan_scanned_at_index" on "core_event_scan" ("scanned_at");`);

    this.addSql(`create table "teams_team" ("id" varchar(255) not null, "name" varchar(255) not null, "tag" varchar(255) not null, "owner_auth_id" varchar(255) not null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "teams_team" add constraint "teams_team_tag_unique" unique ("tag");`);
    this.addSql(`create index "teams_team_tag_index" on "teams_team" ("tag");`);
    this.addSql(`create index "teams_team_owner_auth_id_index" on "teams_team" ("owner_auth_id");`);

    this.addSql(`create table "teams_member" ("id" varchar(255) not null, "team_id" varchar(255) not null, "auth_id" varchar(255) not null, "joined_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "teams_member" add constraint "teams_member_auth_id_unique" unique ("auth_id");`);
    this.addSql(`create index "teams_member_team_id_index" on "teams_member" ("team_id");`);
    this.addSql(`create index "teams_member_auth_id_index" on "teams_member" ("auth_id");`);

    this.addSql(`create table "teams_invite" ("id" varchar(255) not null, "team_id" varchar(255) not null, "invitee_auth_id" varchar(255) not null, "status" text not null default 'pending', "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "teams_invite_team_id_index" on "teams_invite" ("team_id");`);
    this.addSql(`create index "teams_invite_invitee_auth_id_index" on "teams_invite" ("invitee_auth_id");`);
    this.addSql(`create index "teams_invite_team_id_invitee_auth_id_index" on "teams_invite" ("team_id", "invitee_auth_id");`);

    this.addSql(`alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "account" add constraint "account_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "core_user" add constraint "core_user_auth_id_foreign" foreign key ("auth_id") references "user" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "core_user" add constraint "core_user_role_id_foreign" foreign key ("role_id") references "core_role" ("id") on delete set null;`);

    this.addSql(`alter table "discord_verification" add constraint "discord_verification_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on delete set null;`);
    this.addSql(`alter table "discord_verification" add constraint "discord_verification_status_check" check ("status" in ('pending', 'accepted', 'rejected', 'expired'));`);

    this.addSql(`alter table "discord_role_sync_attempt" add constraint "discord_role_sync_attempt_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on delete cascade;`);
    this.addSql(`alter table "discord_role_sync_attempt" add constraint "discord_role_sync_attempt_status_check" check ("status" in ('synced', 'failed', 'skipped'));`);

    this.addSql(`alter table "discord_member" add constraint "discord_member_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on update cascade on delete cascade;`);

    this.addSql(`alter table "core_user_data" add constraint "core_user_data_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on update cascade on delete cascade;`);

    this.addSql(`alter table "core_user_ban" add constraint "core_user_ban_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on update cascade on delete cascade;`);
    this.addSql(`alter table "core_user_ban" add constraint "core_user_ban_banned_by_auth_id_foreign" foreign key ("banned_by_auth_id") references "core_user" ("auth_id");`);

    this.addSql(`alter table "core_setting" add constraint "core_setting_created_by_auth_id_foreign" foreign key ("created_by_auth_id") references "core_user" ("auth_id") on delete set null;`);
    this.addSql(`alter table "core_setting" add constraint "core_setting_updated_by_auth_id_foreign" foreign key ("updated_by_auth_id") references "core_user" ("auth_id") on delete set null;`);

    this.addSql(`alter table "core_rsvp" add constraint "core_rsvp_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on update cascade on delete cascade;`);
    this.addSql(`alter table "core_rsvp" add constraint "core_rsvp_cancelled_by_auth_id_foreign" foreign key ("cancelled_by_auth_id") references "core_user" ("auth_id") on delete set null;`);
    this.addSql(`alter table "core_rsvp" add constraint "core_rsvp_promoted_by_auth_id_foreign" foreign key ("promoted_by_auth_id") references "core_user" ("auth_id") on delete set null;`);
    this.addSql(`alter table "core_rsvp" add constraint "core_rsvp_status_check" check ("status" in ('confirmed', 'waitlisted', 'cancelled'));`);

    this.addSql(`alter table "core_notification_intent" add constraint "core_notification_intent_recipient_auth_id_foreign" foreign key ("recipient_auth_id") references "core_user" ("auth_id") on delete set null;`);
    this.addSql(`alter table "core_notification_intent" add constraint "core_notification_intent_status_check" check ("status" in ('pending', 'processing', 'delivered', 'failed', 'skipped'));`);

    this.addSql(`alter table "core_notification_delivery_attempt" add constraint "core_notification_delivery_attempt_intent_id_foreign" foreign key ("intent_id") references "core_notification_intent" ("id") on delete cascade;`);
    this.addSql(`alter table "core_notification_delivery_attempt" add constraint "core_notification_delivery_attempt_status_check" check ("status" in ('delivered', 'failed', 'skipped'));`);

    this.addSql(`alter table "core_hacker" add constraint "core_hacker_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on update cascade on delete cascade;`);

    this.addSql(`alter table "core_event_scan" add constraint "core_event_scan_event_id_foreign" foreign key ("event_id") references "core_event" ("id") on delete cascade;`);
    this.addSql(`alter table "core_event_scan" add constraint "core_event_scan_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on delete cascade;`);
    this.addSql(`alter table "core_event_scan" add constraint "core_event_scan_scanned_by_auth_id_foreign" foreign key ("scanned_by_auth_id") references "core_user" ("auth_id");`);

    this.addSql(`alter table "teams_team" add constraint "teams_team_owner_auth_id_foreign" foreign key ("owner_auth_id") references "core_user" ("auth_id") on delete cascade;`);

    this.addSql(`alter table "teams_member" add constraint "teams_member_team_id_foreign" foreign key ("team_id") references "teams_team" ("id") on delete cascade;`);
    this.addSql(`alter table "teams_member" add constraint "teams_member_auth_id_foreign" foreign key ("auth_id") references "core_user" ("auth_id") on delete cascade;`);

    this.addSql(`alter table "teams_invite" add constraint "teams_invite_team_id_foreign" foreign key ("team_id") references "teams_team" ("id") on delete cascade;`);
    this.addSql(`alter table "teams_invite" add constraint "teams_invite_invitee_auth_id_foreign" foreign key ("invitee_auth_id") references "core_user" ("auth_id") on delete cascade;`);
    this.addSql(`alter table "teams_invite" add constraint "teams_invite_status_check" check ("status" in ('pending', 'accepted', 'declined'));`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "session" drop constraint "session_user_id_foreign";`);
    this.addSql(`alter table "account" drop constraint "account_user_id_foreign";`);
    this.addSql(`alter table "core_user" drop constraint "core_user_auth_id_foreign";`);
    this.addSql(`alter table "core_event_scan" drop constraint "core_event_scan_event_id_foreign";`);
    this.addSql(`alter table "core_user" drop constraint "core_user_role_id_foreign";`);
    this.addSql(`alter table "discord_verification" drop constraint "discord_verification_auth_id_foreign";`);
    this.addSql(`alter table "discord_role_sync_attempt" drop constraint "discord_role_sync_attempt_auth_id_foreign";`);
    this.addSql(`alter table "discord_member" drop constraint "discord_member_auth_id_foreign";`);
    this.addSql(`alter table "core_user_data" drop constraint "core_user_data_auth_id_foreign";`);
    this.addSql(`alter table "core_user_ban" drop constraint "core_user_ban_auth_id_foreign";`);
    this.addSql(`alter table "core_user_ban" drop constraint "core_user_ban_banned_by_auth_id_foreign";`);
    this.addSql(`alter table "core_setting" drop constraint "core_setting_created_by_auth_id_foreign";`);
    this.addSql(`alter table "core_setting" drop constraint "core_setting_updated_by_auth_id_foreign";`);
    this.addSql(`alter table "core_rsvp" drop constraint "core_rsvp_auth_id_foreign";`);
    this.addSql(`alter table "core_rsvp" drop constraint "core_rsvp_cancelled_by_auth_id_foreign";`);
    this.addSql(`alter table "core_rsvp" drop constraint "core_rsvp_promoted_by_auth_id_foreign";`);
    this.addSql(`alter table "core_notification_intent" drop constraint "core_notification_intent_recipient_auth_id_foreign";`);
    this.addSql(`alter table "core_hacker" drop constraint "core_hacker_auth_id_foreign";`);
    this.addSql(`alter table "core_event_scan" drop constraint "core_event_scan_auth_id_foreign";`);
    this.addSql(`alter table "core_event_scan" drop constraint "core_event_scan_scanned_by_auth_id_foreign";`);
    this.addSql(`alter table "teams_team" drop constraint "teams_team_owner_auth_id_foreign";`);
    this.addSql(`alter table "teams_member" drop constraint "teams_member_auth_id_foreign";`);
    this.addSql(`alter table "teams_invite" drop constraint "teams_invite_invitee_auth_id_foreign";`);
    this.addSql(`alter table "core_notification_delivery_attempt" drop constraint "core_notification_delivery_attempt_intent_id_foreign";`);
    this.addSql(`alter table "teams_member" drop constraint "teams_member_team_id_foreign";`);
    this.addSql(`alter table "teams_invite" drop constraint "teams_invite_team_id_foreign";`);

    this.addSql(`drop table if exists "user" cascade;`);
    this.addSql(`drop table if exists "session" cascade;`);
    this.addSql(`drop table if exists "account" cascade;`);
    this.addSql(`drop table if exists "verification" cascade;`);
    this.addSql(`drop table if exists "core_event" cascade;`);
    this.addSql(`drop table if exists "core_operation_lock" cascade;`);
    this.addSql(`drop table if exists "core_role" cascade;`);
    this.addSql(`drop table if exists "core_user" cascade;`);
    this.addSql(`drop table if exists "discord_verification" cascade;`);
    this.addSql(`drop table if exists "discord_role_sync_attempt" cascade;`);
    this.addSql(`drop table if exists "discord_member" cascade;`);
    this.addSql(`drop table if exists "core_user_data" cascade;`);
    this.addSql(`drop table if exists "core_user_ban" cascade;`);
    this.addSql(`drop table if exists "core_setting" cascade;`);
    this.addSql(`drop table if exists "core_rsvp" cascade;`);
    this.addSql(`drop table if exists "core_notification_intent" cascade;`);
    this.addSql(`drop table if exists "core_notification_delivery_attempt" cascade;`);
    this.addSql(`drop table if exists "core_hacker" cascade;`);
    this.addSql(`drop table if exists "core_event_scan" cascade;`);
    this.addSql(`drop table if exists "teams_team" cascade;`);
    this.addSql(`drop table if exists "teams_member" cascade;`);
    this.addSql(`drop table if exists "teams_invite" cascade;`);
  }

}
