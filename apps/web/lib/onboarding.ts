import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import "server-only";
import {
	buildCompetitorOnboardingSteps,
	getNextOnboardingStepHref,
	type CompetitorOnboardingStep,
} from "@hackkit/ui";
import { CoreSetting } from "@hackkit/core";
import { hackKitUIRoutes } from "./hackkit-ui-routes";
import { getCurrentUser, getHackkit, getRuntime } from "./runtime";
function loadCompetitorOnboardingInput(currentPath: string) {
	return runPromise(
		Effect.gen(function* () {
			const user = yield* fromResult(getCurrentUser());
			const hackkit = yield* fromResult(getHackkit());
			const runtime = yield* fromResult(getRuntime());
			const [userData, hacker, requireApproval] = yield* Effect.all(
				[
					fromResult(hackkit.userData.getUserData(user.id)),
					fromResult(hackkit.hackers.getHacker(user.id)),
					fromResult(
						runtime.getSettingValue(CoreSetting.RequireApproval),
					),
				],
				{ concurrency: "unbounded" },
			);
			return {
				user,
				userData,
				hacker,
				requireApproval: Boolean(requireApproval),
				currentPath,
				routes: hackKitUIRoutes,
			};
		}),
	);
}
export function getOnboardingSteps(
	currentPath: string,
): Promise<CompetitorOnboardingStep[]> {
	return runPromise(
		Effect.gen(function* () {
			const input = yield* fromResult(
				loadCompetitorOnboardingInput(currentPath),
			);
			return buildCompetitorOnboardingSteps(input);
		}),
	);
}
export function getCompetitorOnboardingState(currentPath: string) {
	return runPromise(
		Effect.gen(function* () {
			const input = yield* fromResult(
				loadCompetitorOnboardingInput(currentPath),
			);
			const steps = buildCompetitorOnboardingSteps(input);
			return {
				steps,
				nextHref: getNextOnboardingStepHref(steps),
				user: input.user,
				userData: input.userData,
				hacker: input.hacker,
			};
		}),
	);
}
export function getRequireApproval(): Promise<boolean> {
	return runPromise(
		Effect.gen(function* () {
			return Boolean(
				yield* fromResult(
					(yield* fromResult(getRuntime())).getSettingValue(
						CoreSetting.RequireApproval,
					),
				),
			);
		}),
	);
}
