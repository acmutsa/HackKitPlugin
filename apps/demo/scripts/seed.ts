import { initializeHackkit, HackKitUser, CoreSetting } from "@hackkit/core";
import { RequestContext } from "@mikro-orm/core";
import { resolveHackkitConfig } from "@hackkit/config";
import config from "../hackkit.config";
import { demoAccounts, demoPassword } from "../lib/demo-accounts";
import { runDatabaseCommand } from "./database";

/** Explicit setup for an empty demo database. Never replaces existing users. */
export async function seedDemo() {
	await runDatabaseCommand(config, { command: "migrate" });
	await runDatabaseCommand(config, { command: "seed" });
	const core = await initializeHackkit(resolveHackkitConfig(config));
	try {
		const scope = core.createScope();
		await RequestContext.create(scope.em, async () => {
			if (await scope.em.count(HackKitUser, {})) return;
			const users = new Map<keyof typeof demoAccounts, string>();
			for (const key of Object.keys(
				demoAccounts,
			) as (keyof typeof demoAccounts)[]) {
				const account = demoAccounts[key];
				const { user } = await core.auth.api.signUpEmail({
					body: {
						name: account.name,
						email: account.email,
						password: demoPassword,
					},
				});
				users.set(key, user.id);
				if (key === "newcomer") continue;
				await scope.hackkit.users.claimHackTag({
					authId: user.id,
					hackTag: account.tag,
				});
				await scope.hackkit.userData.completeUserData({
					authId: user.id,
					age: 21,
					gender: "prefer_not_to_answer",
					race: "prefer_not_to_answer",
					ethnicity: "prefer_not_to_answer",
					shirtSize: "m",
					dietaryRestrictions: ["none"],
					hasAcceptedMLHCodeOfConduct: true,
					hasSharedDataWithMLH: true,
					isEmailable: false,
				});
				await scope.hackkit.hackers.registerHacker({
					userId: user.id,
					university: "University of Texas at San Antonio",
					major: "Computer Science",
					levelOfStudy: "Senior",
					hackathonsAttended: 2,
					softwareExperience: "Intermediate",
				});
			}
			const organizerId = users.get("organizer")!;
			await scope.em.nativeUpdate(
				HackKitUser,
				{ id: organizerId },
				{ roleId: "core.owner", isApproved: true },
			);
			scope.em.clear();
			await scope.hackkit.settings.set({
				actorAuthId: organizerId,
				key: CoreSetting.RsvpOpen,
				value: true,
			});
			for (const [title, type, hour, location] of [
				["Opening ceremony", "ceremony", 9, "Main auditorium"],
				[
					"Build your first HackKit plugin",
					"workshop",
					11,
					"Workshop room A",
				],
				["Lunch and team matching", "meal", 12, "Student union"],
				["Project showcase", "ceremony", 17, "Main auditorium"],
			] as const) {
				await scope.hackkit.events.createEvent({
					actorAuthId: organizerId,
					title,
					type,
					location,
					description:
						"A fictional event for exploring HackKit. Try editing this event in the organizer console.",
					startTime: new Date(Date.UTC(2027, 2, 21, hour + 5)),
					endTime: new Date(Date.UTC(2027, 2, 21, hour + 6)),
					host: "Demo organizers",
					hidden: false,
				});
			}
			await scope.hackkit.plugins.teams.createTeam({
				actorAuthId: users.get("teammate")!,
				name: "Weekend Builders",
				tag: "weekend-builders",
			});
		});
	} finally {
		await core.orm.close();
	}
}
