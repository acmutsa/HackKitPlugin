# Effect execution with compatible public APIs

Status: accepted. Refines execution and resource management in ADR 0013. The existing package, persistence, authentication, UI, plugin, and migration decisions remain in force.

## Decision

Application workflows use Effect 3. Core domain operations compose lazy Effects. Plugins, CLI commands, Next integration, web routes, and client interactions use Effect programs for asynchronous work, concurrency, and recovery.

`apps/web`, `packages/ui`, `packages/next`, and `packages/core` keep their existing responsibilities. MikroORM remains the ORM. Better Auth remains responsible for authentication. Applications still own migration histories and explicitly run migrations and seeds. This change requires no database migration.

## Public contracts

Existing functions retain their Promise or synchronous signatures. `promiseApi` converts native domain APIs at their public boundary. `createHackkitEffects` exposes native Core operations for callers that compose Effects. Plugin factories also retain their existing setup contracts.

The exported Zod schemas remain compatible with callers that use `.extend()`, `.omit()`, inferred input types, React Hook Form, and better-call. Domain validation uses Effect Schema through `schemaFromParser` and `decodeInput`. The bridge retains the parser's transformations, unknown-key behavior, and field error details. New transport schemas can use Effect Schema directly.

Expected domain failures use `HackKitError`. External failures use `OperationError` with the original failure in `cause`. Promise adapters restore the original error, including non-Error rejection values. Next redirects and HTTP error mapping therefore continue to receive the error values they expect. Effect defects remain separate from typed failures until a Promise boundary.

## Services and resources

`hackkitLayer` provides `HackKitRuntimeService` and closes the shared ORM when its scope ends. Existing `initializeHackkit` callers retain ownership of `runtime.orm.close()`. `initializeHackkitEffect` supplies the same runtime as a lazy Effect.

`runHackkitEffect` provides `HackKitExecution` with a fresh EntityManager inside MikroORM RequestContext. Actor IDs remain explicit. No request EntityManager or actor is stored in a shared Layer.

Transaction operations finish their database work before interruption takes effect. `withOperationLockEffect` keeps the existing lock write, transaction propagation, unique-constraint mapping, and identity-map cleanup. The native ORM callback is a Promise boundary. CLI connections and SMTP sockets use scoped resource acquisition and release.

Independent reads use `Effect.all` or `Effect.forEach` with the previous concurrency. Ordered writes remain ordered. Notification intents still commit with domain changes, and external deliveries still occur after commit. Provider delivery gains no automatic retries.

## Alternatives

Changing public methods to return Effects would force existing apps, plugins, and HTTP clients to migrate in one release. Keeping Promise adapters lets callers adopt native Effect composition without breaking their current code.

Wrapping each existing async implementation would retain Promise control flow inside domain operations. Native domain factories instead return Effects and compose internal operations before the public adapter runs them.

Replacing the exported Zod objects would break their schema-composition methods. The Effect Schema bridge keeps one validation contract while preserving those objects for existing consumers.

## Verification

`pnpm check:effect` checks production source for remaining async implementations and Promise concurrency or recovery. `pnpm check:api` compares existing package entrypoints against `origin/remove-next-package` using TypeScript assignability. Run the API check after building packages.

Package tests cover domain authorization, transactions, notifications, request isolation, schema transformations, error identity, and resource release. The app's database workflow and production runtime tests exercise committed migrations and real HTTP requests. External database matrix cases still require their configured services.
