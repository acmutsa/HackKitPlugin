import {
	TransactionPropagation,
	UniqueConstraintViolationException,
	type EntityManager,
} from "@mikro-orm/core";
import { Effect } from "effect";
import { CoreOperationLock } from "../models";
import { HackKitError } from "../errors";
import {
	operation,
	originalError,
	runPromise,
	type BoundaryError,
} from "../effect";

/** Keep the transaction alive until all database work finishes, including interruption.
 * The lock write precedes reads. External delivery belongs after commit.
 */
export function withOperationLockEffect<T>(
	em: EntityManager,
	key: string,
	run: () => Effect.Effect<T, BoundaryError> | Promise<T>,
): Effect.Effect<T, BoundaryError> {
	return Effect.suspend(() => {
		const ownsTransaction = !em.isInTransaction();
		return operation(() =>
			em.transactional(
				(transaction) =>
					runPromise(
						Effect.gen(function* () {
							yield* operation(() =>
								transaction.upsert(CoreOperationLock, {
									key,
									token: crypto.randomUUID(),
								}),
							);
							yield* operation(() => transaction.flush());
							return yield* operation(run);
						}),
					),
				{ clear: true, propagation: TransactionPropagation.REQUIRED },
			),
		).pipe(
			Effect.mapError((error) =>
				originalError(error) instanceof
				UniqueConstraintViolationException
					? new HackKitError(
							"CONFLICT",
							"A record with these unique values already exists.",
							{ cause: originalError(error) },
						)
					: error,
			),
			Effect.ensuring(
				Effect.sync(() => {
					if (ownsTransaction) em.clear();
				}),
			),
			Effect.uninterruptible,
		);
	});
}

export function withOperationLock<T>(
	em: EntityManager,
	key: string,
	run: () => Promise<T>,
): Promise<T> {
	return runPromise(withOperationLockEffect(em, key, run));
}
