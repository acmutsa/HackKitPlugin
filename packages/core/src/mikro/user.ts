import { Effect } from "effect";
import { runPromise, fromResult } from "../effect";
import {
	serialize,
	type EntityManager,
	type FilterQuery,
	type InferEntity,
} from "@mikro-orm/core";
import { HackKitUser } from "../models";
import { type User } from "../types";
/** Read the canonical user row as a plain DTO using native serialization. */
export function readUser(
	em: EntityManager,
	where: FilterQuery<InferEntity<typeof HackKitUser>>,
): Promise<User | null> {
	return runPromise(
		Effect.gen(function* () {
			const user = yield* fromResult(em.findOne(HackKitUser, where));
			return user ? serialize(user) : null;
		}),
	);
}
