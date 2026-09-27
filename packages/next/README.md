# `@hackkit/next`

Next.js integration for Core authentication, request scopes, page guards, server actions, and HackKit UI.

## Runtime setup

`createHackkitRuntimeFromConfig({ config, afterCurrentUser? })` returns a host with a shared `core` promise and a `getRuntime` function. Register the function with `setHackkitRuntime(host.getRuntime)`. Use [the reference app runtime](../../apps/web/lib/runtime.ts) as the integration example.

The host initializes one Core ORM and Better Auth instance. Each request or action resolves its session from Next headers and creates a fresh EntityManager and domain API scope. React caches the runtime only within a server render. Never store a request runtime, actor, EntityManager, or settings cache in an application singleton.

`config.database` contains native MikroORM driver options. `config.auth` contains Better Auth options except `database`, which Core owns. `@hackkit/next` adds Better Auth's cookie integration; [the app auth route](../../apps/web/app/api/auth/[...all]/route.ts) delegates to Core's auth handler.

`getCurrentUser` reads the existing HackKit profile and authoritative auth email. It does not create or overwrite profiles. `afterCurrentUser` optionally performs app-specific work after a profile is loaded.

## UI and routes

Pass `hackKitUIActions` to `HackKitUIProvider`. Named server actions resolve the registered runtime and call its mutations. Keep route overrides serializable; custom route-builder functions belong in a client navigation adapter.

Use `runtime.pageGuards` in layouts. Common guards include `requireOnboardingAccess`, `requireParticipantAccess`, `requireApprovalPendingAccess`, `requirePermission`, and `requireNotBanned`.

Plugin actions are generated separately by `hackkit plugin sync`. They use each plugin's `/actions` entrypoint and resolve the same request runtime. Server plugin entrypoints remain usable by the CLI without importing Next.

## Public API

| Export                                    | Role                                                       |
| ----------------------------------------- | ---------------------------------------------------------- |
| `createHackkitRuntimeFromConfig`          | Initializes shared resources and a request runtime factory |
| `createHackkitRuntime`                    | Creates one request runtime from an initialized Core host  |
| `setHackkitRuntime` / `getHackkitRuntime` | Registers and resolves the request factory                 |
| `hackKitUIActions`                        | UI provider action map                                     |
| `createHackKitMutations`                  | Domain-to-UI mutation bridge used by runtime               |
| `createPageGuards`                        | Guard factory used by runtime                              |
| `actionSuccess` / `actionFailure`         | Shared action result helpers                               |

## Adding a Core mutation

1. Add the method to `HackKitUIActions` in `@hackkit/ui`.
2. Implement it in `createHackKitMutations`.
3. Add a thin server action in `src/actions.ts`.
4. Include it in `hackKitUIActions` in `src/action-map.ts`.

Package tests check action-map parity, guard behavior, session isolation, anonymous requests, and profile preservation. Run `pnpm --filter @hackkit/next test` and `pnpm --filter @hackkit/next typecheck` after building dependencies.
