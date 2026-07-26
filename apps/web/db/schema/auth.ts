import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .default(false)
      .notNull(),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    hackTag: text("hack_tag").unique(),
    bio: text("bio"),
    pronouns: text("pronouns"),
    skills: text("skills", { mode: "json" }),
    isProfileSearchable: integer("is_profile_searchable", { mode: "boolean" })
      .default(true)
      .notNull(),
    discordDisplayHandle: text("discord_display_handle"),
    roleId: text("role_id").references(() => coreRole.id, {
      onDelete: "set null",
    }),
    isApproved: integer("is_approved", { mode: "boolean" })
      .default(false)
      .notNull(),
    checkedInAt: integer("checked_in_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("user_hackTag_uidx").on(table.hackTag),
    index("user_roleId_idx").on(table.roleId),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const coreUserData = sqliteTable("core_user_data", {
  id: text("id").primaryKey(),
  authId: text("auth_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  race: text("race").notNull(),
  ethnicity: text("ethnicity").notNull(),
  shirtSize: text("shirt_size").notNull(),
  dietaryRestrictions: text("dietary_restrictions", { mode: "json" }).notNull(),
  accommodationNote: text("accommodation_note"),
  phoneNumber: text("phone_number"),
  countryOfResidence: text("country_of_residence"),
  hasAcceptedMLHCodeOfConduct: integer("has_accepted_mlh_code_of_conduct", {
    mode: "boolean",
  }).notNull(),
  hasSharedDataWithMLH: integer("has_shared_data_with_mlh", {
    mode: "boolean",
  }).notNull(),
  isEmailable: integer("is_emailable", { mode: "boolean" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const coreHacker = sqliteTable(
  "core_hacker",
  {
    id: text("id").primaryKey(),
    authId: text("auth_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    university: text("university").notNull(),
    major: text("major").notNull(),
    schoolId: text("school_id"),
    levelOfStudy: text("level_of_study").notNull(),
    hackathonsAttended: integer("hackathons_attended").notNull(),
    softwareExperience: text("software_experience").notNull(),
    heardFrom: text("heard_from"),
    githubUrl: text("github_url"),
    linkedInUrl: text("linked_in_url"),
    personalWebsiteUrl: text("personal_website_url"),
    resumeUrl: text("resume_url"),
    group: text("group"),
    registeredAt: integer("registered_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("coreHacker_registeredAt_idx").on(table.registeredAt)],
);

export const coreRsvp = sqliteTable(
  "core_rsvp",
  {
    id: text("id").primaryKey(),
    authId: text("auth_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text({ enum: ["confirmed", "waitlisted", "cancelled"] }).notNull(),
    waitlistPosition: integer("waitlist_position"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    waitlistedAt: integer("waitlisted_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    cancelledByAuthId: text("cancelled_by_auth_id").references(() => user.id, {
      onDelete: "set null",
    }),
    promotedAt: integer("promoted_at", { mode: "timestamp_ms" }),
    promotedByAuthId: text("promoted_by_auth_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("coreRsvp_status_idx").on(table.status),
    index("coreRsvp_waitlistPosition_idx").on(table.waitlistPosition),
    index("coreRsvp_createdAt_idx").on(table.createdAt),
    index("coreRsvp_updatedAt_idx").on(table.updatedAt),
  ],
);

export const coreRole = sqliteTable(
  "core_role",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    position: integer("position").notNull(),
    permissions: text("permissions", { mode: "json" }).notNull(),
    color: text("color"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("coreRole_position_idx").on(table.position)],
);

export const coreUserBan = sqliteTable("core_user_ban", {
  id: text("id").primaryKey(),
  authId: text("auth_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: text("reason"),
  bannedByAuthId: text("banned_by_auth_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const coreEvent = sqliteTable(
  "core_event",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    startTime: integer("start_time", { mode: "timestamp_ms" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp_ms" }).notNull(),
    location: text("location").default("TBD").notNull(),
    description: text("description").notNull(),
    type: text("type").notNull(),
    host: text("host"),
    hidden: integer("hidden", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("coreEvent_startTime_idx").on(table.startTime),
    index("coreEvent_type_idx").on(table.type),
    index("coreEvent_hidden_idx").on(table.hidden),
  ],
);

export const coreSetting = sqliteTable(
  "core_setting",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    value: text("value", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    createdByAuthId: text("created_by_auth_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    updatedByAuthId: text("updated_by_auth_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("coreSetting_updatedAt_idx").on(table.updatedAt),
    index("coreSetting_updatedByAuthId_idx").on(table.updatedByAuthId),
  ],
);

export const coreEventScan = sqliteTable(
  "core_event_scan",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => coreEvent.id, { onDelete: "cascade" }),
    authId: text("auth_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scannedByAuthId: text("scanned_by_auth_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scannedAt: integer("scanned_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("coreEventScan_eventId_idx").on(table.eventId),
    index("coreEventScan_authId_idx").on(table.authId),
    index("coreEventScan_scannedAt_idx").on(table.scannedAt),
  ],
);

export const coreNotificationIntent = sqliteTable(
  "core_notification_intent",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    recipientAuthId: text("recipient_auth_id").references(() => user.id, {
      onDelete: "set null",
    }),
    payload: text("payload", { mode: "json" }).notNull(),
    status: text({
      enum: ["pending", "processing", "delivered", "failed", "skipped"],
    })
      .default("pending")
      .notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("coreNotificationIntent_kind_idx").on(table.kind),
    index("coreNotificationIntent_recipientAuthId_idx").on(
      table.recipientAuthId,
    ),
    index("coreNotificationIntent_status_idx").on(table.status),
    index("coreNotificationIntent_createdAt_idx").on(table.createdAt),
  ],
);

export const coreNotificationDeliveryAttempt = sqliteTable(
  "core_notification_delivery_attempt",
  {
    id: text("id").primaryKey(),
    intentId: text("intent_id")
      .notNull()
      .references(() => coreNotificationIntent.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    provider: text("provider"),
    status: text({ enum: ["delivered", "failed", "skipped"] }).notNull(),
    recipient: text("recipient"),
    externalId: text("external_id"),
    error: text("error"),
    metadata: text("metadata", { mode: "json" }).notNull(),
    attemptedAt: integer("attempted_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("coreNotificationDeliveryAttempt_intentId_idx").on(table.intentId),
    index("coreNotificationDeliveryAttempt_channel_idx").on(table.channel),
    index("coreNotificationDeliveryAttempt_status_idx").on(table.status),
    index("coreNotificationDeliveryAttempt_attemptedAt_idx").on(
      table.attemptedAt,
    ),
  ],
);

export const teamsTeam = sqliteTable(
  "teams_team",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tag: text("tag").notNull().unique(),
    ownerAuthId: text("owner_auth_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("teamsTeam_tag_uidx").on(table.tag),
    index("teamsTeam_ownerAuthId_idx").on(table.ownerAuthId),
  ],
);

export const teamsMember = sqliteTable(
  "teams_member",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teamsTeam.id, { onDelete: "cascade" }),
    authId: text("auth_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("teamsMember_teamId_idx").on(table.teamId),
    uniqueIndex("teamsMember_authId_uidx").on(table.authId),
  ],
);

export const teamsInvite = sqliteTable(
  "teams_invite",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teamsTeam.id, { onDelete: "cascade" }),
    inviteeAuthId: text("invitee_auth_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text({ enum: ["pending", "accepted", "declined"] })
      .default("pending")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("teamsInvite_teamId_idx").on(table.teamId),
    index("teamsInvite_inviteeAuthId_idx").on(table.inviteeAuthId),
  ],
);

export const discordVerification = sqliteTable(
  "discord_verification",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    discordUserId: text("discord_user_id").notNull(),
    guildId: text("guild_id").notNull(),
    username: text("username").notNull(),
    avatarHash: text("avatar_hash"),
    authId: text("auth_id").references(() => user.id, { onDelete: "set null" }),
    status: text({ enum: ["pending", "accepted", "rejected", "expired"] })
      .default("pending")
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("discordVerification_discordUserId_idx").on(table.discordUserId),
    index("discordVerification_guildId_idx").on(table.guildId),
    index("discordVerification_authId_idx").on(table.authId),
    index("discordVerification_status_idx").on(table.status),
    index("discordVerification_createdAt_idx").on(table.createdAt),
  ],
);

export const discordMember = sqliteTable(
  "discord_member",
  {
    id: text("id").primaryKey(),
    authId: text("auth_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    discordUserId: text("discord_user_id").notNull().unique(),
    guildId: text("guild_id").notNull(),
    username: text("username").notNull(),
    avatarHash: text("avatar_hash"),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    lastRoleSyncAt: integer("last_role_sync_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("discordMember_discordUserId_uidx").on(table.discordUserId),
    index("discordMember_guildId_idx").on(table.guildId),
    index("discordMember_updatedAt_idx").on(table.updatedAt),
  ],
);

export const discordRoleSyncAttempt = sqliteTable(
  "discord_role_sync_attempt",
  {
    id: text("id").primaryKey(),
    authId: text("auth_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    discordUserId: text("discord_user_id").notNull(),
    guildId: text("guild_id").notNull(),
    status: text({ enum: ["synced", "failed", "skipped"] }).notNull(),
    roleIds: text("role_ids", { mode: "json" }).notNull(),
    roleNames: text("role_names", { mode: "json" }).notNull(),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("discordRoleSyncAttempt_authId_idx").on(table.authId),
    index("discordRoleSyncAttempt_discordUserId_idx").on(table.discordUserId),
    index("discordRoleSyncAttempt_status_idx").on(table.status),
    index("discordRoleSyncAttempt_createdAt_idx").on(table.createdAt),
  ],
);

export const userRelations = relations(user, ({ one, many }) => ({
  coreRole: one(coreRole, {
    fields: [user.roleId],
    references: [coreRole.id],
  }),
  sessions: many(session),
  accounts: many(account),
  coreUserData: many(coreUserData),
  coreHacker: many(coreHacker),
  coreRsvps: many(coreRsvp),
  coreUserBans: many(coreUserBan),
  coreSettings: many(coreSetting),
  coreEventScans: many(coreEventScan),
  coreNotificationIntents: many(coreNotificationIntent),
  teamsTeams: many(teamsTeam),
  teamsMember: many(teamsMember),
  teamsInvites: many(teamsInvite),
  discordVerifications: many(discordVerification),
  discordMember: many(discordMember),
  discordRoleSyncAttempts: many(discordRoleSyncAttempt),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const coreUserDataRelations = relations(coreUserData, ({ one }) => ({
  user: one(user, {
    fields: [coreUserData.authId],
    references: [user.id],
  }),
}));

export const coreHackerRelations = relations(coreHacker, ({ one }) => ({
  user: one(user, {
    fields: [coreHacker.authId],
    references: [user.id],
  }),
}));

export const coreRsvpAuthIdRelations = relations(coreRsvp, ({ one }) => ({
  user: one(user, {
    fields: [coreRsvp.authId],
    references: [user.id],
  }),
}));

export const coreRsvpCancelledByAuthIdRelations = relations(
  coreRsvp,
  ({ one }) => ({
    user: one(user, {
      fields: [coreRsvp.cancelledByAuthId],
      references: [user.id],
    }),
  }),
);

export const coreRsvpPromotedByAuthIdRelations = relations(
  coreRsvp,
  ({ one }) => ({
    user: one(user, {
      fields: [coreRsvp.promotedByAuthId],
      references: [user.id],
    }),
  }),
);

export const coreRoleRelations = relations(coreRole, ({ many }) => ({
  users: many(user),
}));

export const coreUserBanAuthIdRelations = relations(coreUserBan, ({ one }) => ({
  user: one(user, {
    fields: [coreUserBan.authId],
    references: [user.id],
  }),
}));

export const coreUserBanBannedByAuthIdRelations = relations(
  coreUserBan,
  ({ one }) => ({
    user: one(user, {
      fields: [coreUserBan.bannedByAuthId],
      references: [user.id],
    }),
  }),
);

export const coreEventRelations = relations(coreEvent, ({ many }) => ({
  coreEventScans: many(coreEventScan),
}));

export const coreSettingCreatedByAuthIdRelations = relations(
  coreSetting,
  ({ one }) => ({
    user: one(user, {
      fields: [coreSetting.createdByAuthId],
      references: [user.id],
    }),
  }),
);

export const coreSettingUpdatedByAuthIdRelations = relations(
  coreSetting,
  ({ one }) => ({
    user: one(user, {
      fields: [coreSetting.updatedByAuthId],
      references: [user.id],
    }),
  }),
);

export const coreEventScanAuthIdRelations = relations(
  coreEventScan,
  ({ one }) => ({
    user: one(user, {
      fields: [coreEventScan.authId],
      references: [user.id],
    }),
  }),
);

export const coreEventScanScannedByAuthIdRelations = relations(
  coreEventScan,
  ({ one }) => ({
    user: one(user, {
      fields: [coreEventScan.scannedByAuthId],
      references: [user.id],
    }),
  }),
);

export const coreEventScanRelations = relations(coreEventScan, ({ one }) => ({
  coreEvent: one(coreEvent, {
    fields: [coreEventScan.eventId],
    references: [coreEvent.id],
  }),
}));

export const coreNotificationIntentRelations = relations(
  coreNotificationIntent,
  ({ one, many }) => ({
    user: one(user, {
      fields: [coreNotificationIntent.recipientAuthId],
      references: [user.id],
    }),
    coreNotificationDeliveryAttempts: many(coreNotificationDeliveryAttempt),
  }),
);

export const coreNotificationDeliveryAttemptRelations = relations(
  coreNotificationDeliveryAttempt,
  ({ one }) => ({
    coreNotificationIntent: one(coreNotificationIntent, {
      fields: [coreNotificationDeliveryAttempt.intentId],
      references: [coreNotificationIntent.id],
    }),
  }),
);

export const teamsTeamRelations = relations(teamsTeam, ({ one, many }) => ({
  user: one(user, {
    fields: [teamsTeam.ownerAuthId],
    references: [user.id],
  }),
  teamsMembers: many(teamsMember),
  teamsInvites: many(teamsInvite),
}));

export const teamsMemberRelations = relations(teamsMember, ({ one }) => ({
  teamsTeam: one(teamsTeam, {
    fields: [teamsMember.teamId],
    references: [teamsTeam.id],
  }),
  user: one(user, {
    fields: [teamsMember.authId],
    references: [user.id],
  }),
}));

export const teamsInviteRelations = relations(teamsInvite, ({ one }) => ({
  teamsTeam: one(teamsTeam, {
    fields: [teamsInvite.teamId],
    references: [teamsTeam.id],
  }),
  user: one(user, {
    fields: [teamsInvite.inviteeAuthId],
    references: [user.id],
  }),
}));

export const discordVerificationRelations = relations(
  discordVerification,
  ({ one }) => ({
    user: one(user, {
      fields: [discordVerification.authId],
      references: [user.id],
    }),
  }),
);

export const discordMemberRelations = relations(discordMember, ({ one }) => ({
  user: one(user, {
    fields: [discordMember.authId],
    references: [user.id],
  }),
}));

export const discordRoleSyncAttemptRelations = relations(
  discordRoleSyncAttempt,
  ({ one }) => ({
    user: one(user, {
      fields: [discordRoleSyncAttempt.authId],
      references: [user.id],
    }),
  }),
);
