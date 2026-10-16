import { Cause, Data, Effect, Exit } from "effect";
import { HackKitError } from "./errors";

/** An untyped failure from a filesystem, SDK, transport, or other external API. */
export class OperationError extends Data.TaggedError("OperationError")<{
	readonly cause: unknown;
}> {}

export type BoundaryError = HackKitError | OperationError;

export function boundaryError(cause: unknown): BoundaryError {
	return cause instanceof HackKitError || cause instanceof OperationError
		? cause
		: new OperationError({ cause });
}

/** Adapt a lazy external operation, or compose an existing Effect without running it. */
export function operation<A, E, R>(
	evaluate: () => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | BoundaryError, R>;
export function operation<A>(
	evaluate: () => A | PromiseLike<A>,
): Effect.Effect<A, BoundaryError>;
export function operation<A, E, R>(
	evaluate: () => A | PromiseLike<A> | Effect.Effect<A, E, R>,
): Effect.Effect<A, E | BoundaryError, R>;
export function operation(
	evaluate: () => unknown,
): Effect.Effect<unknown, unknown, unknown> {
	return Effect.suspend(() => {
		try {
			const value = evaluate();
			if (Effect.isEffect(value)) return value;
			if (
				!(value instanceof Promise) &&
				!(
					typeof value === "object" &&
					value !== null &&
					"then" in value
				)
			)
				return Effect.succeed(value);
			return Effect.tryPromise({
				try: () => Promise.resolve(value),
				catch: boundaryError,
			});
		} catch (cause) {
			return Effect.fail(boundaryError(cause));
		}
	});
}

export type OperationValue<T> =
	T extends Effect.Effect<infer A, infer _E, infer _R> ? A : Awaited<T>;
export type OperationFailure<T> =
	T extends Effect.Effect<infer _A, infer E, infer _R> ? E : BoundaryError;
export type OperationContext<T> =
	T extends Effect.Effect<infer _A, infer _E, infer R> ? R : never;
export function fromResult<T>(
	value: T,
): Effect.Effect<OperationValue<T>, OperationFailure<T>, OperationContext<T>>;
export function fromResult(
	value: unknown,
): Effect.Effect<unknown, unknown, unknown> {
	return operation(() => value);
}

export function promiseFunction<Args extends readonly unknown[], A, E>(
	fn: (...args: Args) => Effect.Effect<A, E>,
): (...args: Args) => Promise<A> {
	return (...args) => runPromise(fn(...args));
}

/** Preserve error identity at existing Promise, framework, and SDK boundaries. */
export function originalError(error: unknown): unknown {
	return error instanceof OperationError ? error.cause : error;
}

export function exitValue<A, E>(exit: Exit.Exit<A, E>): A {
	if (Exit.isSuccess(exit)) return exit.value;
	// A failing finally block replaces the original rejection in a Promise API.
	let cause: Cause.Cause<unknown> = exit.cause;
	while (Cause.isSequentialType(cause))
		cause = Cause.isEmptyType(cause.right) ? cause.left : cause.right;
	throw originalError(Cause.squash(cause));
}

export function runPromise<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
	return Effect.runPromiseExit(effect).then(exitValue);
}

export function runSync<A, E>(effect: Effect.Effect<A, E>): A {
	return exitValue(Effect.runSyncExit(effect));
}

export type PromiseApi<T extends object> = {
	[K in keyof T]: T[K] extends (
		...args: infer Args
	) => Effect.Effect<infer A, infer _E>
		? (...args: Args) => Promise<A>
		: T[K];
};

/** The only Promise conversion needed by a native domain API. Preserve data and getters. */
export function promiseApi<T extends object>(api: T): PromiseApi<T> {
	const result: object = Object.create(Object.getPrototypeOf(api));
	for (const key of Reflect.ownKeys(api)) {
		const descriptor = Object.getOwnPropertyDescriptor(api, key);
		if (!descriptor) continue;
		const value: unknown = descriptor.value;
		if (typeof value === "function") {
			descriptor.value = (...args: unknown[]) => {
				const output: unknown = Reflect.apply(value, api, args);
				return Effect.isEffect(output)
					? runPromise(output as Effect.Effect<unknown, unknown>)
					: output;
			};
		}
		Object.defineProperty(result, key, descriptor);
	}
	return result as PromiseApi<T>;
}

export { decodeInput, schemaFromParser } from "./effect-schema";

/** Link an Effect fiber to a Promise callback's async context and await its cleanup. */
export function promiseContext<A, E>(
	start: (signal: AbortSignal) => Promise<Exit.Exit<A, E>>,
): Effect.Effect<A, E | BoundaryError> {
	return Effect.suspend(() => {
		const controller = new AbortController();
		return Effect.async<A, E | BoundaryError>((resume) => {
			let pending: Promise<Exit.Exit<A, E>>;
			try {
				pending = start(controller.signal);
			} catch (error) {
				resume(Effect.fail(boundaryError(error)));
				return;
			}
			void pending.then(
				(exit) => resume(exit),
				(error) => resume(Effect.fail(boundaryError(error))),
			);
			return Effect.promise(() => {
				controller.abort();
				return pending.then(
					() => undefined,
					() => undefined,
				);
			});
		});
	});
}
