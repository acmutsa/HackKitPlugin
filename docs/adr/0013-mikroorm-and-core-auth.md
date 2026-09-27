# MikroORM as the sole ORM, with Better Auth in Core

Status: accepted. Supersedes the persistence and authentication boundaries in ADRs 0001, 0002, and 0008.

## Decision

Core and server plugins use native MikroORM `defineEntity` definitions and `EntityManager` queries. PostgreSQL, MySQL, SQLite, and libSQL are supported. The generic DatabaseAdapter, adapter factories, custom schema language, schema compiler, and Drizzle packages have been removed. Framework independence, domain operations, authorization, plugin registration, and app ownership of migrations remain.

`initializeHackkit` collects Core entities, Better Auth entities, enabled plugin entities, and app entities before initializing the ORM. The CLI uses `createOrmOptions` with this same collection. Plugin table names start with the plugin ID converted to snake_case plus an underscore. Duplicate entity names and table names fail initialization.

One ORM owns shared connections. Each request, action, job, or CLI operation gets a fresh EntityManager. `runtime.createScope(actorAuthId)` binds domain and plugin APIs; `runtime.run(callback, actorAuthId)` also provides MikroORM RequestContext. Transactions use a fresh identity map and clear the parent map on completion. Domain responses are plain DTOs; managed entities and authentication secrets stay on the server. Browser code imports `@hackkit/core/client`.

## Authentication

Core constructs Better Auth with `@a77ay/better-auth-mikro-orm`. Better Auth still declares its own unused Drizzle adapter as an upstream dependency; HackKit does not import it, and `drizzle-orm` is absent from the resolved dependency graph. This community MikroORM adapter is pinned alongside Better Auth and MikroORM and covered by real database tests. Apps provide secrets, providers, trusted origins, email behavior, and optional auth plugins. Next owns request headers, cookies, redirects, and auth route handlers.

Better Auth's user ID is the canonical Auth ID. Its user table owns email. HackKit's profile stores name, profile details, role, approval, and check-in state with a cascading foreign key to the auth user. A MikroORM flush subscriber creates the profile in the same transaction as the identity. Session reads never recreate profiles or copy provider values over profile edits. User Data and Hacker registration remain separate domain records.

Auth fields and plugin tables must have native entity metadata before startup. Core checks the Better Auth schema requirements and rejects undeclared fields or tables. Additional auth models belong in the shared registry and need reviewed migrations.

## Consistency and side effects

Multi-step domain changes run in transactions. A portable operation-lock row serializes capacity and membership decisions before reads. Unique constraints provide additional protection. These locks trade some write concurrency for consistent behavior across supported SQL drivers.

Notification intents persist with the domain change. Workers claim pending intents with an atomic conditional update before contacting providers. Discord verification commits its linked account and consumed code before external role synchronization. External delivery is not part of a database transaction; provider failures are recorded by existing attempt tracking. An interrupted worker can leave a processing intent requiring operational recovery.

## Migrations and releases

Apps commit native MikroORM migrations and snapshots for PostgreSQL, MySQL, and SQLite; libSQL shares SQLite migrations. `hackkit db generate` creates a reviewable migration. `hackkit db migrate` explicitly applies it, and `hackkit db seed` explicitly inserts missing configured roles. Startup and plugin sync do neither.

For an entity change, generate and review each dialect's migration. Plugin removal may propose dropping tables; review retention requirements before applying that migration. This is a fresh-database redesign. There is no migration of existing deployed data or user accounts.

## Validation

The app database matrix applies committed migrations and tests real SQLite, local libSQL, PostgreSQL, MySQL, and HTTP libSQL. It checks schema agreement, signup/session/profile behavior, native JSON/date/boolean/null values, rollback, concurrent registration capacity, teams, uniqueness, and foreign-key cleanup. Package tests cover domain authorization, request isolation, notification claims, and membership conflicts. CI requires external service URLs so those cases cannot silently skip.

Use Node.js 22.17 or newer and TypeScript 5.9.3. Production validation must also cover the deployment's credentials, TLS, OAuth providers, and external email/Discord services.
