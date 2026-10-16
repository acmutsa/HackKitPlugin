import { Effect } from "effect";
import { operation, originalError, runPromise } from "@hackkit/core/effect";
import {
	type HackKitDatabaseOptions,
	type HackKitAuthOptions,
	type InitializeHackkitOptions,
	type EventTypesInput,
	type HackKitLoggerOptions,
	type GroupsInput,
	type HackKitPlugin,
	type SeedRoleInput,
	type UserDataOptionsInput,
} from "@hackkit/core";
import { createJiti } from "jiti";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type HackkitBlobLocalConfig = {
	adapter: "local";
	baseDir: string;
	filesRoutePrefix?: string;
};

export type HackkitBlobS3Config = {
	adapter: "s3";
	bucket: string;
	region: string;
	endpoint?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	publicUrlBase?: string;
	filesRoutePrefix?: string;
};

export type HackkitBlobConfig = HackkitBlobLocalConfig | HackkitBlobS3Config;

export type HackkitSeedRole = SeedRoleInput;

export type RegistrationOption = {
	value: string;
	label: string;
};

export type HackerRegistrationOptions = {
	schools?: readonly RegistrationOption[];
	majors?: readonly RegistrationOption[];
	levelsOfStudy?: readonly RegistrationOption[];
	softwareExperience?: readonly RegistrationOption[];
	heardFrom?: readonly RegistrationOption[];
};

export type HackkitConfig<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = {
	plugins?: TPlugins;
	database: HackKitDatabaseOptions;
	auth: HackKitAuthOptions;
	entities?: InitializeHackkitOptions["entities"];
	userDataOptions?: UserDataOptionsInput;
	hackerRegistrationOptions?: HackerRegistrationOptions;
	eventTypes?: EventTypesInput;
	groups?: GroupsInput;
	logger?: HackKitLoggerOptions;
	defaultCompetitorRoleId?: string;
	seedRoles?: readonly HackkitSeedRole[];
	blob?: HackkitBlobConfig;
};

export type NormalizedHackkitConfig<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = Omit<HackkitConfig<TPlugins>, "plugins" | "seedRoles"> & {
	plugins: TPlugins;
	seedRoles: readonly HackkitSeedRole[];
};

export function defineHackkitConfig<const TConfig extends HackkitConfig>(
	config: TConfig,
): TConfig {
	return config;
}

export function resolveHackkitConfig<
	const TPlugins extends readonly HackKitPlugin[] = [],
>(config: HackkitConfig<TPlugins>): NormalizedHackkitConfig<TPlugins> {
	if (!config?.database?.driver) {
		throw new Error(
			"HackKit config must include native MikroORM database options and a driver.",
		);
	}
	if (!config.auth)
		throw new Error("HackKit config must include Better Auth options.");
	return {
		...config,
		plugins: config.plugins ?? ([] as unknown as TPlugins),
		seedRoles: config.seedRoles ?? [],
	};
}

const jiti = createJiti(fileURLToPath(import.meta.url));

export function loadHackkitConfig(
	configFile = "hackkit.config.ts",
	options: { cwd?: string } = {},
): Promise<NormalizedHackkitConfig> {
	return runPromise(
		Effect.gen(function* () {
			const configPath = resolve(
				options.cwd ?? process.cwd(),
				configFile,
			);
			const module = yield* operation(() => jiti.import(configPath));
			const config = ((module as { default?: HackkitConfig }).default ??
				module) as HackkitConfig;
			return yield* operation(() => resolveHackkitConfig(config)).pipe(
				Effect.mapError((failure) => {
					const error = originalError(failure);
					return error instanceof Error
						? new Error(
								`${error.message} Config path: ${configPath}`,
							)
						: failure;
				}),
			);
		}),
	);
}
