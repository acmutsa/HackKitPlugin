import { Cause, Effect } from "effect";
import { HackKitError } from "./errors";
import {
	operation,
	originalError,
	runPromise,
	type BoundaryError,
} from "./effect";

import {
	type DomainLogContext,
	type HackKitLogger,
	type LogLevel,
	logDomain,
} from "./adapters/logger";

type LogContext = Omit<
	DomainLogContext,
	"outcome" | "errorCode" | "errorMessage"
>;
type LogOptions = { successLevel?: LogLevel; errorLevel?: LogLevel };

export function withDomainLogEffect<T>(
	logger: HackKitLogger,
	action: string,
	context: LogContext,
	run: () => Effect.Effect<T, BoundaryError> | Promise<T>,
	options?: LogOptions,
): Effect.Effect<T, BoundaryError> {
	return operation(run).pipe(
		Effect.tap(() =>
			Effect.sync(() =>
				logDomain(logger, options?.successLevel ?? "info", action, {
					...context,
					outcome: "success",
				}),
			),
		),
		Effect.tapErrorCause((cause) =>
			Effect.sync(() => {
				const error = originalError(Cause.squash(cause));
				logDomain(
					logger,
					error instanceof HackKitError
						? (options?.errorLevel ?? "warn")
						: "error",
					action,
					{
						...context,
						outcome: "error",
						...(error instanceof HackKitError
							? { errorCode: error.code }
							: {}),
						errorMessage:
							error instanceof Error
								? error.message
								: "Unknown error",
					},
				);
			}),
		),
	);
}

export function withDomainLog<T>(
	logger: HackKitLogger,
	action: string,
	context: LogContext,
	run: () => Promise<T>,
	options?: LogOptions,
): Promise<T> {
	return runPromise(
		withDomainLogEffect(logger, action, context, run, options),
	);
}
