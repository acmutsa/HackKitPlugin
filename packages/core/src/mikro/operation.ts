import {
	TransactionPropagation,
	UniqueConstraintViolationException,
	type EntityManager,
} from "@mikro-orm/core";
import { CoreOperationLock } from "../models.js";
import { HackKitError } from "../errors.js";

/** Serialize a read/check/write decision across connections, including SQLite.
 * The upsert writes before any reads, acquiring the database's write/row lock.
 * A fresh token forces a write even when the lock row is already managed.
 * Callbacks contain database work only; deliver external effects after commit.
 */
export async function withOperationLock<T>(
	em: EntityManager,
	key: string,
	operation: () => Promise<T>,
): Promise<T> {
	const ownsTransaction = !em.isInTransaction();
	try {
		return await em.transactional(
			async (transaction) => {
				await transaction.upsert(CoreOperationLock, {
					key,
					token: crypto.randomUUID(),
				});
				await transaction.flush();
				return operation();
			},
			{ clear: true, propagation: TransactionPropagation.REQUIRED },
		);
	} catch (error) {
		if (error instanceof UniqueConstraintViolationException) {
			throw new HackKitError(
				"CONFLICT",
				"A record with these unique values already exists.",
				{ cause: error },
			);
		}
		throw error;
	} finally {
		// A completed operation is a unit-of-work boundary. Reload subsequent reads
		// from the database, and never retain entities from a rolled-back operation.
		if (ownsTransaction) em.clear();
	}
}
