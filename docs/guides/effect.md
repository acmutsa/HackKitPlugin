# Compose Core operations with Effect

Use the existing Promise APIs when integrating with framework or SDK callbacks. To compose domain operations as Effects, use `createHackkitEffects` with the current scope's EntityManager.

```ts
import { Effect } from "effect";
import {
	createHackkitEffects,
	HackKitExecution,
	hackkitLayer,
	runHackkitEffect,
} from "@hackkit/core";
import { runPromise } from "@hackkit/core/effect";
import config from "./hackkit.config";

const listRoles = runHackkitEffect(
	Effect.gen(function* () {
		const { em } = yield* HackKitExecution;
		const hackkit = createHackkitEffects({ ...config, em });
		return yield* hackkit.roles.listRoles();
	}),
);

// config contains the same database and auth options as initializeHackkit.
const roles = await runPromise(
	listRoles.pipe(Effect.provide(hackkitLayer(config))),
);
```

For a long-running process, provide `hackkitLayer` around the process's full Effect program so its operations share one ORM. Each `runHackkitEffect` call still receives a fresh execution scope. Pass an actor ID as its second argument when a plugin requires an authenticated actor.

Use `operation(() => sdkCall())` to adapt an external Promise or synchronous operation lazily. Failures retain their original value in `OperationError.cause`. `runPromise` restores that value when returning to an existing Promise API. Use `Effect.either` or `Effect.catchAll` inside an Effect program to recover from expected failures.

Keep external provider delivery outside transaction callbacks. Call `withOperationLockEffect` for native database workflows that need the existing serialized read, check, and write operation. The Promise `withOperationLock` entrypoint remains available to existing consumers.

For existing parser contracts, use `decodeInput(parser, input)` from `@hackkit/core/effect`. For a new external payload, define an Effect Schema and decode it at the transport boundary.

See [the execution decision](../adr/0014-effect-execution-and-compatible-boundaries.md) for ownership, compatibility, and resource-lifecycle rules.

Plugins expose `createTeamsEffects`, `createDiscordEffects`, and `createEmailNotificationsEffects` for native composition with their setup context. Their existing Promise factories remain available.
