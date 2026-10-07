import type { InferEntity, EntityDTO } from "@mikro-orm/core";
import type { coreModels } from "./models";

export type AuthId = string;
export type UserId = AuthId;
export type RoleId = string;
export type PermissionKey = `${string}.${string}`;

export type User = EntityDTO<InferEntity<typeof coreModels.user>>;
export type UserData = EntityDTO<InferEntity<typeof coreModels.userData>>;
export type Hacker = EntityDTO<InferEntity<typeof coreModels.hacker>>;
export type Rsvp = EntityDTO<InferEntity<typeof coreModels.rsvp>>;
export type Role = EntityDTO<InferEntity<typeof coreModels.role>>;
export type UserBan = EntityDTO<InferEntity<typeof coreModels.userBan>>;
export type Event = EntityDTO<InferEntity<typeof coreModels.event>>;
export type EventScan = EntityDTO<InferEntity<typeof coreModels.eventScan>>;
export type HackathonSetting = EntityDTO<
	InferEntity<typeof coreModels.setting>
>;
export type NotificationIntent = EntityDTO<
	InferEntity<typeof coreModels.notificationIntent>
>;
export type NotificationDeliveryAttempt = EntityDTO<
	InferEntity<typeof coreModels.notificationDeliveryAttempt>
>;

export type AdminUserRecord = {
	user: User;
	userData: UserData | null;
	hacker: Hacker | null;
	rsvp: Rsvp | null;
	role: Role | null;
	ban: UserBan | null;
};

export type PublicUserProfile = {
	user: Pick<
		User,
		| "id"
		| "name"
		| "profilePhotoUrl"
		| "hackTag"
		| "bio"
		| "pronouns"
		| "skills"
		| "discordDisplayHandle"
	>;
	hacker: Pick<
		Hacker,
		| "university"
		| "major"
		| "levelOfStudy"
		| "githubUrl"
		| "linkedInUrl"
		| "personalWebsiteUrl"
	> | null;
	role: Role | null;
};

export type AdminOverview = {
	totalUsers: number;
	totalHackers: number;
	approvedUsers: number;
	pendingApprovalUsers: number;
	bannedUsers: number;
	checkedInUsers: number;
	confirmedRsvps: number;
	waitlistedRsvps: number;
	recentSignups: { date: string; count: number }[];
	recentUsers: AdminUserRecord[];
};

export type AdminUserExportRow = {
	id: User["id"];
	email: string;
	name: string;
	hackTag: string;
	role: string;
	isApproved: boolean;
	isBanned: boolean;
	rsvpStatus: string;
	rsvpWaitlistPosition: number | "";
	banReason: string;
	checkedInAt: string;
	createdAt: string;
	age: number | "";
	gender: string;
	race: string;
	ethnicity: string;
	shirtSize: string;
	dietaryRestrictions: string;
	accommodationNote: string;
	phoneNumber: string;
	countryOfResidence: string;
	hasAcceptedMLHCodeOfConduct: boolean | "";
	hasSharedDataWithMLH: boolean | "";
	isEmailable: boolean | "";
	university: string;
	major: string;
	schoolId: string;
	levelOfStudy: string;
	hackathonsAttended: number | "";
	softwareExperience: string;
	heardFrom: string;
	githubUrl: string;
	linkedInUrl: string;
	personalWebsiteUrl: string;
	resumeUrl: string;
	group: string;
	registeredAt: string;
};
