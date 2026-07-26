import type {
	EventTypesInput,
	HackKitLoggerOptions,
	GroupsInput,
	HackKitPlugin,
	UserDataOptionsInput,
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

export type HackkitConfig = {
	plugins?: readonly HackKitPlugin[];
	userDataOptions?: UserDataOptionsInput;
	hackerRegistrationOptions?: HackerRegistrationOptions;
	eventTypes?: EventTypesInput;
	groups?: GroupsInput;
	logger?: HackKitLoggerOptions;
	defaultCompetitorRoleId?: string;
	blob?: HackkitBlobConfig;
};

export type NormalizedHackkitConfig<
	TPlugins extends readonly HackKitPlugin[] = readonly HackKitPlugin[],
> = Omit<HackkitConfig, "plugins"> & {
	plugins: TPlugins;
};

type ConfigPlugins<TConfig extends HackkitConfig> = TConfig extends {
	plugins: infer TPlugins extends readonly HackKitPlugin[];
}
	? TPlugins
	: readonly [];

export function defineHackkitConfig<const TConfig extends HackkitConfig>(
	config: TConfig,
): TConfig {
	return config;
}

export function resolveHackkitConfig<const TConfig extends HackkitConfig>(
	config: TConfig,
): Omit<TConfig, "plugins"> & NormalizedHackkitConfig<ConfigPlugins<TConfig>> {
	return {
		...config,
		plugins: config.plugins ?? [],
	} as unknown as Omit<TConfig, "plugins"> &
		NormalizedHackkitConfig<ConfigPlugins<TConfig>>;
}

const jiti = createJiti(fileURLToPath(import.meta.url));

export async function loadHackkitConfig(
	configFile = "hackkit.config.ts",
	options: { cwd?: string } = {},
): Promise<NormalizedHackkitConfig> {
	const configPath = resolve(options.cwd ?? process.cwd(), configFile);
	const module = await jiti.import(configPath);
	const config = ((module as { default?: HackkitConfig }).default ??
		module) as HackkitConfig;
	try {
		return resolveHackkitConfig(config);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`${error.message} Config path: ${configPath}`);
		}
		throw error;
	}
}
