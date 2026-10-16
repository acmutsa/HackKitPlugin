import {
	operation,
	promiseApi,
	type BoundaryError,
	runPromise,
	fromResult,
} from "../effect";

import { Effect } from "effect";

import { withOperationLockEffect } from "../mikro/operation";
import { type HackKitLogger } from "../adapters/logger";
import { type EntityManager } from "@mikro-orm/core";
import { HackKitError } from "../errors";
import { coreModels } from "../models";
import { CorePermission } from "../permissions";
import {
	type CoreSettingValueMap,
	type HackathonSettingDefinition,
	type ResolvedHackathonSetting,
	type SettingKey,
	type SettingValue,
	validateSettingValue,
} from "../settings";

import { type AuthId, type PermissionKey } from "../types";
type SettingsApiContext = {
	em: EntityManager;
	now: () => Date;
	logger: HackKitLogger;
	settings: readonly HackathonSettingDefinition[];
	requirePermission: (
		actorAuthId: AuthId,
		permission: PermissionKey,
	) => Promise<unknown>;
};
type SettingRow = import("../types").HackathonSetting;
export type SetHackathonSettingInput = {
	actorAuthId: AuthId;
	key: SettingKey;
	value: unknown;
};
export type SetManyHackathonSettingsInput = {
	actorAuthId: AuthId;
	values: readonly {
		key: SettingKey;
		value: unknown;
	}[];
};
export type ResetHackathonSettingInput = {
	actorAuthId: AuthId;
	key: SettingKey;
};
export type ResetManyHackathonSettingsInput = {
	actorAuthId: AuthId;
	keys: readonly SettingKey[];
};
function createDefinitionMap(
	definitions: readonly HackathonSettingDefinition[],
) {
	return new Map(
		definitions.map((definition) => [definition.key, definition]),
	);
}
function getDefinition(
	definitions: Map<SettingKey, HackathonSettingDefinition>,
	key: SettingKey,
): HackathonSettingDefinition {
	const definition = definitions.get(key);
	if (!definition) {
		throw new HackKitError(
			"NOT_FOUND",
			`Hackathon setting '${key}' is not registered.`,
		);
	}
	return definition;
}
function resolveSetting(
	definition: HackathonSettingDefinition,
	row: SettingRow | null,
): ResolvedHackathonSetting {
	if (!row) {
		return {
			...definition,
			value: definition.defaultValue,
			isDefault: true,
		} as ResolvedHackathonSetting;
	}
	return {
		...definition,
		value: validateSettingValue(definition, row.value),
		isDefault: false,
		createdAt: row.createdAt,
		createdByAuthId: row.createdByAuthId,
		updatedAt: row.updatedAt,
		updatedByAuthId: row.updatedByAuthId,
	} as ResolvedHackathonSetting;
}
export function createSettingsEffects(context: SettingsApiContext) {
	const definitions = createDefinitionMap(context.settings);
	function requireManage(actorAuthId: AuthId) {
		return Effect.gen(function* () {
			yield* fromResult(
				context.requirePermission(
					actorAuthId,
					CorePermission.SettingsManage,
				),
			);
		});
	}
	function getRow(
		key: SettingKey,
	): Effect.Effect<SettingRow | null, BoundaryError> {
		return Effect.suspend(() =>
			fromResult(context.em.findOne(coreModels.setting, { key })),
		);
	}
	function getValue(
		key: SettingKey,
	): Effect.Effect<SettingValue, BoundaryError> {
		return Effect.gen(function* () {
			const definition = yield* operation(() =>
				getDefinition(definitions, key),
			);
			const row = yield* getRow(key);
			return (yield* operation(() => resolveSetting(definition, row)))
				.value;
		});
	}
	function writeSetting(
		actorAuthId: AuthId,
		key: SettingKey,
		value: SettingValue,
	): Effect.Effect<void, BoundaryError> {
		return Effect.gen(function* () {
			const timestamp = context.now();
			const existing = yield* getRow(key);
			if (existing) {
				{
					const updatedRows = yield* fromResult(
						context.em.find(coreModels.setting, {
							key,
						}),
					);
					for (const row of updatedRows)
						context.em.assign(
							row,
							{
								value,
								updatedAt: timestamp,
								updatedByAuthId: actorAuthId,
							},
							{ ignoreUndefined: true },
						);
					yield* fromResult(context.em.flush());
				}
			} else {
				{
					context.em.create(coreModels.setting, {
						key,
						value,
						createdAt: timestamp,
						createdByAuthId: actorAuthId,
						updatedAt: timestamp,
						updatedByAuthId: actorAuthId,
					});
					yield* fromResult(context.em.flush());
				}
			}
			context.logger.log("info", "hackathon setting changed", {
				action: "settings.set",
				actorAuthId,
				settingKey: key,
				outcome: "success",
			});
		});
	}
	function resetSetting(
		actorAuthId: AuthId,
		key: SettingKey,
	): Effect.Effect<void, BoundaryError> {
		return Effect.gen(function* () {
			yield* fromResult(
				context.em.nativeDelete(coreModels.setting, { key }),
			);
			context.logger.log("info", "hackathon setting reset", {
				action: "settings.reset",
				actorAuthId,
				settingKey: key,
				outcome: "success",
			});
		});
	}
	return {
		getValue: getValue as {
			<TKey extends keyof CoreSettingValueMap>(
				key: TKey,
			): Effect.Effect<CoreSettingValueMap[TKey], BoundaryError>;
			(key: SettingKey): Effect.Effect<SettingValue, BoundaryError>;
		},
		get(input: {
			actorAuthId: AuthId;
			key: SettingKey;
		}): Effect.Effect<ResolvedHackathonSetting, BoundaryError> {
			return Effect.gen(function* () {
				yield* requireManage(input.actorAuthId);
				const definition = yield* operation(() =>
					getDefinition(definitions, input.key),
				);
				return yield* operation(
					resolveSetting.bind(
						undefined,
						definition,
						yield* getRow(input.key),
					),
				);
			});
		},
		list(input: {
			actorAuthId: AuthId;
		}): Effect.Effect<ResolvedHackathonSetting[], BoundaryError> {
			return Effect.gen(function* () {
				yield* requireManage(input.actorAuthId);
				const rows = new Map(
					(yield* fromResult(
						context.em.find(coreModels.setting, {}),
					)).map((row) => [row.key, row]),
				);
				return yield* operation(() =>
					context.settings.map((definition) =>
						resolveSetting(
							definition,
							rows.get(definition.key) ?? null,
						),
					),
				);
			});
		},
		set(
			input: SetHackathonSettingInput,
		): Effect.Effect<ResolvedHackathonSetting, BoundaryError> {
			return Effect.gen(this, function* () {
				const [setting] = yield* this.setMany({
					actorAuthId: input.actorAuthId,
					values: [{ key: input.key, value: input.value }],
				});
				return setting;
			});
		},
		setMany(
			input: SetManyHackathonSettingsInput,
		): Effect.Effect<ResolvedHackathonSetting[], BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(context.em, "settings", () =>
					Effect.gen(function* () {
						yield* requireManage(input.actorAuthId);
						const parsed = yield* operation(() =>
							input.values.map(({ key, value }) => {
								const definition = getDefinition(
									definitions,
									key,
								);
								return {
									key,
									definition,
									value: validateSettingValue(
										definition,
										value,
									),
								};
							}),
						);
						for (const update of parsed) {
							yield* writeSetting(
								input.actorAuthId,
								update.key,
								update.value,
							);
						}
						return yield* Effect.forEach(
							parsed,
							({ key, definition }) =>
								Effect.gen(function* () {
									const row = yield* getRow(key);
									return yield* operation(() =>
										resolveSetting(definition, row),
									);
								}),
							{ concurrency: "unbounded" },
						);
					}),
				),
			);
		},
		reset(
			input: ResetHackathonSettingInput,
		): Effect.Effect<ResolvedHackathonSetting, BoundaryError> {
			return Effect.gen(this, function* () {
				const [setting] = yield* this.resetMany({
					actorAuthId: input.actorAuthId,
					keys: [input.key],
				});
				return setting;
			});
		},
		resetMany(
			input: ResetManyHackathonSettingsInput,
		): Effect.Effect<ResolvedHackathonSetting[], BoundaryError> {
			return Effect.suspend(() =>
				withOperationLockEffect(context.em, "settings", () =>
					Effect.gen(function* () {
						yield* requireManage(input.actorAuthId);
						const definitionsToReset = yield* operation(() =>
							input.keys.map((key) =>
								getDefinition(definitions, key),
							),
						);
						for (const definition of definitionsToReset) {
							yield* resetSetting(
								input.actorAuthId,
								definition.key,
							);
						}
						return yield* operation(() =>
							definitionsToReset.map((definition) =>
								resolveSetting(definition, null),
							),
						);
					}),
				),
			);
		},
	};
}
export function settingsToPromise(
	effects: ReturnType<typeof createSettingsEffects>,
) {
	const api = promiseApi(effects);
	// Keep the existing key-specific overloads at the public boundary.
	const getValue = ((key: SettingKey) =>
		runPromise(effects.getValue(key))) as {
		<TKey extends keyof CoreSettingValueMap>(
			key: TKey,
		): Promise<CoreSettingValueMap[TKey]>;
		(key: SettingKey): Promise<SettingValue>;
	};
	return { ...api, getValue };
}
export function createSettingsApi(context: SettingsApiContext) {
	return settingsToPromise(createSettingsEffects(context));
}
