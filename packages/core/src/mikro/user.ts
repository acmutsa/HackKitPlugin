import {
	wrap,
	type EntityManager,
	type FilterQuery,
	type InferEntity,
} from "@mikro-orm/core";
import { HackKitUser } from "../models.js";
import type { User } from "../types.js";

/** Keep the domain Auth ID API while serializing the single native user row. */
export function toUser(user: InferEntity<typeof HackKitUser>): User {
	const { id, ...data } = wrap(user).toObject();
	return { ...data, authId: id };
}

export async function readUser(
	em: EntityManager,
	where: FilterQuery<InferEntity<typeof HackKitUser>>,
): Promise<User | null> {
	const user = await em.findOne(HackKitUser, where);
	return user ? toUser(user) : null;
}
