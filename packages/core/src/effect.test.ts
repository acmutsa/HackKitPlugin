import { SqliteDriver } from "@mikro-orm/sqlite";
import { Deferred, Effect, Exit, Fiber, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { HackKitError, parseInput } from "./errors";
import {
	boundaryError,
	fromResult,
	operation,
	originalError,
	promiseApi,
	runPromise,
} from "./effect";
import { decodeInput, schemaFromParser } from "./effect-schema";
import { hackTagSchema, registerHackerSchema } from "./schemas";
import {
	HackKitExecution,
	HackKitRuntimeService,
	hackkitLayer,
	initializeHackkitEffect,
	runHackkitEffect,
	type HackKitRuntime,
} from "./runtime";
import { createHackkitEffects } from "./hackkit";

const options = {
	database: { driver: SqliteDriver, dbName: ":memory:" },
	auth: {
		secret: "effect-test-secret-with-at-least-32-characters",
		baseURL: "http://localhost:3000",
		emailAndPassword: { enabled: true },
	},
	logger: { disabled: true },
};

describe("Effect compatibility boundaries", () => {
	it("keeps native operations lazy and preserves original rejection values", async () => {
		let calls = 0;
		const error = new HackKitError("CONFLICT", "Already claimed.");
		const native = {
			read: () =>
				operation(() => {
					calls++;
					return 42;
				}),
			fail: () => Effect.fail(error),
			broken: () =>
				operation(() => {
					throw error;
				}),
		};
		const effect = native.read();
		expect(calls).toBe(0);
		expect(await runPromise(effect)).toBe(42);
		const api = promiseApi(native);
		expect(await api.read()).toBe(42);
		await expect(api.fail()).rejects.toBe(error);
		await expect(api.broken()).rejects.toBe(error);
		const cleanup = new Error("Cleanup failed");
		await expect(
			Promise.reject(error).finally(() => {
				throw cleanup;
			}),
		).rejects.toBe(cleanup);
		await expect(
			runPromise(
				Effect.fail(error).pipe(Effect.ensuring(Effect.die(cleanup))),
			),
		).rejects.toBe(cleanup);

		const arbitraryFailure = { provider: "offline" };
		await expect(
			runPromise(operation(() => Promise.reject(arbitraryFailure))),
		).rejects.toBe(arbitraryFailure);
		expect(originalError(boundaryError(arbitraryFailure))).toBe(
			arbitraryFailure,
		);
	});

	it("preserves parser transformations and the existing validation details", async () => {
		expect(await runPromise(decodeInput(hackTagSchema, "My_Tag"))).toBe(
			"my_tag",
		);
		expect(
			await runPromise(
				Schema.decodeUnknown(schemaFromParser(hackTagSchema))("My_Tag"),
			),
		).toBe("my_tag");
		let previous: unknown;
		try {
			parseInput(registerHackerSchema, {});
		} catch (error) {
			previous = error;
		}
		const result = await Effect.runPromiseExit(
			decodeInput(registerHackerSchema, {}),
		);
		expect(Exit.isFailure(result)).toBe(true);
		await expect(
			runPromise(decodeInput(registerHackerSchema, {})),
		).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
			message: "Invalid HackKit input.",
			details:
				previous instanceof HackKitError ? previous.details : undefined,
		});
		const failure = new Error("Custom parser failed");
		await expect(
			runPromise(
				decodeInput(
					{
						parse() {
							throw failure;
						},
					},
					{},
				),
			),
		).rejects.toBe(failure);
	});
});

describe("Effect runtime", () => {
	it("keeps invalid registry configuration in the typed failure channel", async () => {
		const result = await Effect.runPromise(
			Effect.either(
				initializeHackkitEffect({
					...options,
					plugins: [{ id: "duplicate" }, { id: "duplicate" }],
				}),
			),
		);
		expect(result._tag).toBe("Left");
		if (result._tag === "Left")
			expect(result.left).toMatchObject({ code: "CONFLICT" });
	});

	it.each([false, true])(
		"closes real database connections after use, failure=%s",
		async (fail) => {
			let captured: HackKitRuntime | undefined;
			const expected = new HackKitError(
				"INVALID_OPERATION",
				"Stop after initialization.",
			);
			const program = Effect.gen(function* () {
				const runtime = yield* HackKitRuntimeService;
				captured = runtime;
				yield* operation(() => runtime.orm.schema.create());
				expect(yield* operation(() => runtime.orm.isConnected())).toBe(
					true,
				);
				if (fail) return yield* Effect.fail(expected);
			}).pipe(Effect.provide(hackkitLayer(options)));
			if (fail) await expect(runPromise(program)).rejects.toBe(expected);
			else await runPromise(program);
			if (!captured) throw new Error("Runtime was not acquired");
			expect(await captured.orm.isConnected()).toBe(false);
		},
	);

	it("releases the runtime Layer when its fiber is interrupted", async () => {
		await runPromise(
			Effect.gen(function* () {
				const acquired = yield* Deferred.make<HackKitRuntime>();
				const work = Effect.gen(function* () {
					const runtime = yield* HackKitRuntimeService;
					yield* operation(() => runtime.orm.schema.create());
					yield* Deferred.succeed(acquired, runtime);
					yield* Effect.never;
				}).pipe(Effect.provide(hackkitLayer(options)));
				const fiber = yield* Effect.fork(work);
				const runtime = yield* Deferred.await(acquired);
				yield* Fiber.interrupt(fiber);
				expect(yield* operation(() => runtime.orm.isConnected())).toBe(
					false,
				);
			}),
		);
	});

	it("waits for an interrupted request's finalizers before releasing its context", async () => {
		await runPromise(
			Effect.gen(function* () {
				const runtime = yield* HackKitRuntimeService;
				const acquired = yield* Deferred.make();
				let released = false;
				const request = runHackkitEffect(
					Effect.scoped(
						Effect.gen(function* () {
							yield* Effect.acquireRelease(Effect.void, () =>
								Effect.sync(() => {
									released = true;
								}),
							);
							yield* Deferred.succeed(acquired, undefined);
							yield* Effect.never;
						}),
					),
				);
				const fiber = yield* Effect.fork(request);
				yield* Deferred.await(acquired);
				yield* Fiber.interrupt(fiber);
				expect(released).toBe(true);
			}).pipe(Effect.provide(hackkitLayer(options))),
		);
	});

	it("isolates concurrent execution services and composes native domain operations", async () => {
		await runPromise(
			Effect.gen(function* () {
				const runtime = yield* HackKitRuntimeService;
				yield* operation(() => runtime.orm.schema.create());
				const scopes = yield* Effect.all(
					[
						runHackkitEffect(HackKitExecution),
						runHackkitEffect(HackKitExecution),
					],
					{ concurrency: "unbounded" },
				);
				expect(scopes[0].em).not.toBe(scopes[1].em);
				const native = createHackkitEffects({
					em: scopes[0].em,
					logger: { disabled: true },
				});
				const result = yield* Effect.either(
					native.users.claimHackTag({
						authId: "missing",
						hackTag: "valid",
					}),
				);
				expect(result._tag).toBe("Left");
				if (result._tag === "Left")
					expect(result.left).toMatchObject({ code: "NOT_FOUND" });

				const missingSetting = yield* Effect.either(
					native.settings.getValue("missing.setting"),
				);
				expect(missingSetting._tag).toBe("Left");
				if (missingSetting._tag === "Left")
					expect(missingSetting.left).toMatchObject({
						code: "NOT_FOUND",
					});
				const values = yield* fromResult(native.roles.listRoles());
				expect(values).toEqual([]);
			}).pipe(Effect.provide(hackkitLayer(options))),
		);
	});
});
