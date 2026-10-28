import { defineHackkitConfig } from "@hackkit/config";
import { CorePermission } from "@hackkit/core";
import { databaseOptions } from "./lib/database-config";
import { authOptions } from "./lib/auth-options";
import { env } from "./env";
const shirtSizeOptions = [
	{ value: "s", label: "Small" },
	{ value: "m", label: "Medium" },
	{ value: "l", label: "Large" },
	{ value: "xl", label: "Extra large" },
	{ value: "2xl", label: "2XL" },
	{ value: "3xl", label: "3XL" },
];

const countryOptions = [
	{ value: "us", label: "United States" },
	{ value: "ca", label: "Canada" },
	{ value: "mx", label: "Mexico" },
	{ value: "gb", label: "United Kingdom" },
	{ value: "other", label: "Other" },
];

const schoolOptions = [
	{
		value: "University of Texas at San Antonio",
		label: "University of Texas at San Antonio",
	},
	{
		value: "University of Texas at Austin",
		label: "University of Texas at Austin",
	},
	{ value: "Texas A&M University", label: "Texas A&M University" },
	{ value: "Rice University", label: "Rice University" },
	{ value: "other", label: "Other" },
];

const majorOptions = [
	{ value: "Computer Science", label: "Computer Science" },
	{ value: "Computer Engineering", label: "Computer Engineering" },
	{ value: "Electrical Engineering", label: "Electrical Engineering" },
	{ value: "Data Science", label: "Data Science" },
	{ value: "Design", label: "Design" },
	{ value: "Business", label: "Business" },
	{ value: "other", label: "Other" },
];

const levelsOfStudy = [
	{ value: "Freshman", label: "Freshman" },
	{ value: "Sophomore", label: "Sophomore" },
	{ value: "Junior", label: "Junior" },
	{ value: "Senior", label: "Senior" },
	{ value: "Graduate", label: "Graduate" },
	{ value: "Recent Grad", label: "Recent Grad" },
	{ value: "Other", label: "Other" },
];

const softwareExperienceOptions = [
	{ value: "Beginner", label: "Beginner" },
	{ value: "Intermediate", label: "Intermediate" },
	{ value: "Advanced", label: "Advanced" },
	{ value: "Expert", label: "Expert" },
];

const heardFromOptions = [
	{ value: "Instagram", label: "Instagram" },
	{ value: "Class Presentation", label: "Class presentation" },
	{ value: "Twitter", label: "Twitter" },
	{ value: "Event Site", label: "Event site" },
	{ value: "Friend", label: "Friend" },
	{ value: "Other", label: "Other" },
];

export default defineHackkitConfig({
	database: databaseOptions,
	auth: authOptions,
	defaultCompetitorRoleId: "core.participant",
	seedRoles: [
		{
			id: "core.participant",
			name: "Participant",
			position: 10,
			permissions: [],
		},
		{
			id: "core.owner",
			name: "Owner",
			position: 0,
			permissions: Object.values(CorePermission),
		},
	],
	blob: { adapter: "local", baseDir: env.localBlobBaseDir },
	logger: { level: env.nodeEnv === "production" ? "warn" : "debug" },
	plugins: [],
	userDataOptions: {
		shirtSize: shirtSizeOptions,
		countryOfResidence: countryOptions,
	},
	hackerRegistrationOptions: {
		schools: schoolOptions,
		majors: majorOptions,
		levelsOfStudy,
		softwareExperience: softwareExperienceOptions,
		heardFrom: heardFromOptions,
	},
});
