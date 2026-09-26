import type { MikroORM } from "@mikro-orm/core";
import { mikroOrmAdapter } from "@a77ay/better-auth-mikro-orm";
import { betterAuth, type BetterAuthOptions } from "better-auth";

export type HackKitAuthOptions = Omit<BetterAuthOptions, "database">;

/** The application supplies credentials and providers; Core owns the database adapter. */
export function createHackKitAuth(orm: MikroORM, options: HackKitAuthOptions) {
	return betterAuth({
		...options,
		database: mikroOrmAdapter(orm),
	});
}
