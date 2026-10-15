import type {
	Event,
	EventTypes,
	ResolvedHackathonSetting,
	Rsvp,
	RsvpSummary,
	User,
} from "@hackkit/core/client";

export type {
	EventTypeOption,
	EventTypes,
	ResolvedHackathonSetting,
	Rsvp,
	RsvpSummary,
	SettingKey,
	UserDataOptions,
} from "@hackkit/core/client";

export type UserDataFormValues = {
	age: number;
	gender: string;
	race: string;
	ethnicity: string;
	shirtSize: string;
	dietaryRestrictions: string[];
	accommodationNote?: string;
	phoneNumber?: string;
	countryOfResidence?: string;
	hasAcceptedMLHCodeOfConduct: boolean;
	hasSharedDataWithMLH: boolean;
	isEmailable: boolean;
};

export type HackTagFormValues = {
	hackTag: string;
};

export type UserProfileFormValues = {
	name: string;
	hackTag: string;
	bio?: string;
	pronouns?: string;
	skills: string[];
	isProfileSearchable: boolean;
	discordDisplayHandle?: string;
	profilePhotoUrl?: string;
};

export type HackerRegistrationFormValues = {
	university: string;
	major: string;
	schoolId?: string;
	levelOfStudy: string;
	hackathonsAttended: number;
	softwareExperience: string;
	heardFrom?: string;
	githubUrl?: string;
	linkedInUrl?: string;
	personalWebsiteUrl?: string;
	resumeUrl?: string;
};

export type EventFormValues = {
	title: string;
	description: string;
	startTime: string;
	endTime: string;
	location: string;
	type: string;
	host: string;
	hidden: boolean;
};

export type ScheduleListProps = {
	events: Event[];
	eventTypes: EventTypes;
	getEventHref?: (event: Event) => string;
	className?: string;
};

export type EventPassProps = {
	user: User;
	qrPayload: string;
	onRefreshQr: () => void;
	className?: string;
};

export type EventAdminFormProps = {
	eventTypes: EventTypes;
	defaultValues?: Partial<EventFormValues>;
	eventId?: string;
	submitLabel?: string;
	successRedirectTo?: string;
	className?: string;
};

export type EventScannerProps = {
	event: Event;
	className?: string;
	onDone?: () => void;
};

export type CheckInScannerProps = {
	className?: string;
	onDone?: () => void;
};

export type HackathonSettingsFormProps = {
	settings: ResolvedHackathonSetting[];
	className?: string;
};

export type RsvpConfirmationProps = {
	rsvp: Rsvp | null;
	summary: RsvpSummary;
	className?: string;
};
