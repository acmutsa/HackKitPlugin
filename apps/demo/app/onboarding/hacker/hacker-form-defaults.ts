import type { Hacker } from "@hackkit/core";

export function toHackerFormDefaults(hacker: Hacker | null) {
	if (!hacker) return undefined;
	return {
		university: hacker.university,
		major: hacker.major,
		schoolId: hacker.schoolId ?? undefined,
		levelOfStudy: hacker.levelOfStudy,
		hackathonsAttended: hacker.hackathonsAttended,
		softwareExperience: hacker.softwareExperience,
		heardFrom: hacker.heardFrom ?? undefined,
		githubUrl: hacker.githubUrl ?? undefined,
		linkedInUrl: hacker.linkedInUrl ?? undefined,
		personalWebsiteUrl: hacker.personalWebsiteUrl ?? undefined,
		resumeUrl: hacker.resumeUrl ?? undefined,
	};
}
