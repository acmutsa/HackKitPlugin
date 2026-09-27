import {
	wrap,
	type EntityManager,
	type FilterQuery,
	type InferEntity,
} from "@mikro-orm/core";
import { AuthUser } from "./auth-entities.js";
import { HackKitProfile } from "../models.js";
import type { User } from "../types.js";

/** Domain profile data uses Better Auth's current email without copying it. */
export async function toUser(
	em: EntityManager,
	profile: InferEntity<typeof HackKitProfile>,
): Promise<User> {
	const identity = await em.findOneOrFail(AuthUser, { id: profile.authId });
	return { ...wrap(profile).toObject(), email: identity.email };
}

export async function readUser(
	em: EntityManager,
	where: FilterQuery<InferEntity<typeof HackKitProfile>>,
): Promise<User | null> {
	const profile = await em.findOne(HackKitProfile, where);
	return profile ? toUser(em, profile) : null;
}
