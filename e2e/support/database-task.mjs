import { createJiti } from "jiti";
import { initializeHackkit, HackKitUser, CoreSetting } from "@hackkit/core";
import { resolve } from "node:path";

// This executable belongs only to E2E. Applications expose no bootstrap endpoint.
const [action, userId, value] = process.argv.slice(2);
if (!userId || !["promote", "approval"].includes(action))
	throw new Error(
		"Choose promote or approval and provide a canonical test user ID.",
	);
const jiti = createJiti(import.meta.url);
const { default: config } = await jiti.import(resolve("hackkit.config.ts"));
const core = await initializeHackkit(config);
try {
	const scope = core.createScope();
	if (action === "promote") {
		const updated = await scope.em.nativeUpdate(
			HackKitUser,
			{ id: userId },
			{ roleId: "core.owner" },
		);
		if (updated !== 1) throw new Error("Expected one existing test user.");
	} else {
		if (value !== "true" && value !== "false")
			throw new Error("Approval requires true or false.");
		await scope.hackkit.settings.set({
			actorAuthId: userId,
			key: CoreSetting.RequireApproval,
			value: value === "true",
		});
	}
} finally {
	await core.orm.close();
}
