import { Effect } from "effect";
import { runPromise, fromResult } from "../../effect";
import { z } from "zod";
import { type SettingKey } from "../../settings";
import { createMutationFactory, type RequestRunner } from "../mutation";
const settingKey = z
	.string()
	.refine((value): value is SettingKey => /^[^.]+\..+$/.test(value));
export function createSettingEndpoints(run: RequestRunner) {
	const post = createMutationFactory(run);
	return {
		listSettings: post(
			"/settings/list",
			z.undefined(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(hackkit.settings.list({ actorAuthId })),
					),
				),
		),
		setSettings: post(
			"/settings/set",
			z
				.object({
					values: z.array(
						z
							.object({
								key: settingKey,
								value: z.union([z.boolean(), z.number()]),
							})
							.strict(),
					),
				})
				.strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.settings.setMany({
								actorAuthId,
								values: input.values,
							}),
						),
					),
				),
		),
		resetSetting: post(
			"/settings/reset",
			z.object({ key: settingKey }).strict(),
			({ hackkit, actorAuthId }, input) =>
				runPromise(
					Effect.suspend(() =>
						fromResult(
							hackkit.settings.reset({
								actorAuthId,
								key: input.key,
							}),
						),
					),
				),
		),
	};
}
