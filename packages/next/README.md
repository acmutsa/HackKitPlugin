# `@hackkit/next`

Next.js request setup and page guards for HackKit. Core owns the HTTP endpoints and typed path client.

## Runtime setup

`createHackkitRuntimeFromConfig({ config, afterCurrentUser? })` returns a shared `core` promise, a request-local `getRuntime` factory, and an HTTP `handler`. Register `host.getRuntime` with `setHackkitRuntime` for package-owned plugin pages. The reference implementation is [the app runtime](../../templates/nextjs-full/lib/runtime.ts).

The host initializes one Core ORM and Better Auth instance. Each server render resolves its session from Next headers and creates a fresh domain scope. React caches this runtime within that render. HTTP calls resolve the session from their Web Request and run their operation inside Core's native MikroORM RequestContext. Shared endpoint definitions never retain a request's actor or EntityManager.

`config.database` supplies native MikroORM driver options. `config.auth` supplies Better Auth options except its database adapter, which Core owns. The host adds Better Auth's Next cookie integration. `auth.baseURL` must be an explicit URL; HTTP mutation origins use its origin plus the static `auth.trustedOrigins` list. Wildcard and dynamic origin rules are outside this browser contract.

Mount `host.handler` as POST at `/api/hackkit/[...path]`. Keep the Better Auth GET/POST route at `/api/auth/[...all]`. The two routes share authentication and connections.

## UI and plugin setup

Create a client with `createHackkitClient` from `@hackkit/core/http/client` and pass it to `HackKitUIProvider`. Components call typed paths, such as `client("@post/users/claim-hack-tag", { body: values })`. Better-call returns `{ data, error }`. Dates in results are ISO strings, and successful empty results contain null. Check `result.error.status` for HTTP failures.

Plugin sync generates page route reexports. Plugin components import their endpoint type from the plugin's `/client` entry and call `useHackkitClient<TeamsEndpoints>()`. The hook memoizes a native path client using the provider's base URL, headers, and optional fetch implementation. It requires no generated descriptors or runtime client registration. See the [integration guide](../../docs/guides/next-integration.md) for the full request and response behavior.

Use `runtime.pageGuards` in server layouts. Common guards include `requireOnboardingAccess`, `requireParticipantAccess`, `requireApprovalPendingAccess`, `requirePermission`, and `requireNotBanned`. `getCurrentUser` reads the saved profile and optionally runs `afterCurrentUser`.

## Adding a browser operation

Define its path, strict body schema, and operation in Core's endpoint factory, or in the owning plugin's endpoint factory. Actor fields come from the authenticated runner. Keep permission and domain rules in Core or the plugin. Build the package to update its declarations. Call the typed path in the component and handle `result.error` before success effects or refresh.

There is no action map or app-level wrapper to maintain. Read-only server pages and jobs continue to use Core directly. The initial browser contract supports static POST paths. GET/query endpoints and dynamic path parameters are not implemented.
