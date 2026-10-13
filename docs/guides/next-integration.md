# Next.js integration

Use `@hackkit/next` to connect HackKit Core, Better Auth, and HackKit UI. The [package README](../../packages/next/README.md) describes the API; the [reference app](../../apps/web/README.md) contains setup and database commands.

## Ownership

| Concern                            | Owner               | App integration                                                |
| ---------------------------------- | ------------------- | -------------------------------------------------------------- |
| Connections, entities, Better Auth | Core                | Supply `database`, `auth`, plugins, and app entities in config |
| Request session and EntityManager  | Next runtime        | Register `host.getRuntime` as a function                       |
| Auth HTTP and cookies              | Next                | Route GET/POST to Core's auth handler                          |
| Guards and mutations               | Request runtime     | Resolve `getRuntime()` in layouts and actions                  |
| Core UI actions                    | `hackKitUIActions`  | Pass to `HackKitUIProvider`                                    |
| Plugin routes/actions              | CLI sync            | Import generated modules                                       |
| Migrations and seed data           | App release process | Explicit CLI commands                                          |

## Request lifecycle

The app creates one host with `createHackkitRuntimeFromConfig({ config })`. Its Core promise owns shared connections and auth. `setHackkitRuntime(host.getRuntime)` registers a factory. Each request resolves its session, forks an EntityManager, and binds domain and plugin APIs to the authenticated actor. Settings are read through that scope. No request state is retained in a module singleton.

Auth signup creates the Better Auth identity and HackKit profile in one transaction. Session reads use the existing profile, so user edits survive later sign-ins. Domain methods return plain DTOs; authentication records and managed entities stay on the server.

For background jobs, use Core's `runtime.run(callback, actorAuthId)` or create an explicit scope. Close the Core ORM when the process ends. Browser components import `@hackkit/core/client` for schemas, constants, and types.

## Page integration

| Area             | Guard                                      | Mutation examples                              |
| ---------------- | ------------------------------------------ | ---------------------------------------------- |
| Onboarding       | `requireOnboardingAccess`                  | Claim tag, complete User Data, register Hacker |
| Participant      | `requireParticipantAccess`                 | Profile, RSVP, teams                           |
| Pending approval | `requireApprovalPendingAccess`             | Read approval status                           |
| Admin            | `requireNotBanned` and `requirePermission` | Administration, scans, settings                |

Use the runtime's guards and mutations. Keep the UI provider map in `@hackkit/next`. Plugin actions use their package's `/actions` entrypoint and the same registered runtime. Route maps passed from server components must contain serializable values; custom builders belong in a client navigation adapter.

## Verification

Package tests cover action-map parity, redirects, session isolation, and profile preservation. The app matrix validates committed migrations and auth/domain behavior across supported drivers. Run the package tests, `pnpm --filter web typecheck`, and `pnpm --filter web build` after building the web dependency graph.

See [ADR 0013](../adr/0013-mikroorm-and-core-auth.md) for registry, transaction, authentication, and migration decisions.
