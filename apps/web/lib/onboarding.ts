import "server-only";

import {
	buildCompetitorOnboardingSteps,
	getNextOnboardingStepHref,
	type CompetitorOnboardingStep,
} from "@hackkit/ui";
import { CoreSetting } from "@hackkit/core";
import { hackKitUIRoutes } from "./hackkit-ui-routes";
import { auth } from "./auth";
import {
	getCurrentHackkitUser,
	getHackkitSetting,
	hackkitHeaders,
} from "./hackkit-server";

async function loadCompetitorOnboardingInput(currentPath: string) {
	const user = await getCurrentHackkitUser();
	const requestHeaders = await hackkitHeaders();
	const [userData, hacker, requireApproval] = await Promise.all([
		auth.api.getHackkitUserData({ headers: requestHeaders }),
		auth.api.getHackkitHacker({ headers: requestHeaders }),
		getHackkitSetting(CoreSetting.RequireApproval),
	]);
	return {
		user,
		userData,
		hacker,
		requireApproval: Boolean(requireApproval),
		currentPath,
		routes: hackKitUIRoutes,
	};
}

export async function getOnboardingSteps(
	currentPath: string,
): Promise<CompetitorOnboardingStep[]> {
	const input = await loadCompetitorOnboardingInput(currentPath);
	return buildCompetitorOnboardingSteps(input);
}

export async function getCompetitorOnboardingState(currentPath: string) {
	const input = await loadCompetitorOnboardingInput(currentPath);
	const steps = buildCompetitorOnboardingSteps(input);
	return {
		steps,
		nextHref: getNextOnboardingStepHref(steps),
		user: input.user,
		userData: input.userData,
		hacker: input.hacker,
	};
}

export async function getRequireApproval(): Promise<boolean> {
	return Boolean(await getHackkitSetting(CoreSetting.RequireApproval));
}
