import type {
	DatabaseAdapterFactory,
	EventTypesInput,
	HackKitLoggerOptions,
	GroupsInput,
	HackKitPlugin,
	SeedRoleInput,
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

export type HackkitConfig = {
	plugins?: readonly HackKitPlugin[];
	database: DatabaseAdapterFactory;
	userDataOptions?: UserDataOptionsInput;
	hackerRegistrationOptions?: HackerRegistrationOptions;
	eventTypes?: EventTypesInput;
	groups?: GroupsInput;
	logger?: HackKitLoggerOptions;
	defaultCompetitorRoleId?: string;
	seedRoles?: readonly HackkitSeedRole[];
	blob?: HackkitBlobConfig;
};

export type NormalizedHackkitConfig = Omit<
	HackkitConfig,
	"plugins" | "seedRoles"
> & {
	plugins: readonly HackKitPlugin[];
	seedRoles: readonly HackkitSeedRole[];
};

export function defineHackkitConfig<const TConfig extends HackkitConfig>(
	config: TConfig,
): TConfig {
	return config;
}

export function resolveHackkitConfig(
	config: HackkitConfig,
): NormalizedHackkitConfig {
	if (!config?.database) {
		throw new Error("HackKit config must include a database adapter.");
	}
	return {
		...config,
		plugins: config.plugins ?? [],
		seedRoles: config.seedRoles ?? [],
	};
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
