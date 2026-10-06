# MikroORM as the sole ORM, with Better Auth in Core

Status: accepted. Supersedes the persistence and authentication boundaries in ADRs 0001, 0002, 0004, and 0008.

## Decision

Core and server plugins use native MikroORM `defineEntity` definitions and `EntityManager` queries. PostgreSQL, MySQL, SQLite, and libSQL are supported. The generic DatabaseAdapter, adapter factories, custom schema language, schema compiler, and Drizzle packages have been removed. Framework independence, domain operations, authorization, plugin registration, and app ownership of migrations remain.

`initializeHackkit` collects Core entities, Better Auth entities, enabled plugin entities, and app entities before initializing the ORM. The CLI uses `createOrmOptions` with this same collection. Plugin table names start with the plugin ID converted to snake_case plus an underscore. Duplicate entity names and table names fail initialization.

One ORM owns shared connections. Each request, action, job, or CLI operation gets a fresh EntityManager. `runtime.createScope(actorAuthId)` binds domain and plugin APIs; `runtime.run(callback, actorAuthId)` also provides MikroORM RequestContext. Transactions use a fresh identity map and clear the parent map on completion. Domain responses are plain DTOs; managed entities and authentication secrets stay on the server. Browser code imports `@hackkit/core/client`.

## Authentication

Core constructs Better Auth with `@a77ay/better-auth-mikro-orm`. Better Auth still declares its own unused Drizzle adapter as an upstream dependency; HackKit does not import it, and `drizzle-orm` is absent from the resolved dependency graph. This community MikroORM adapter is pinned alongside Better Auth and MikroORM and covered by real database tests. Apps provide secrets, providers, trusted origins, email behavior, and optional auth plugins. Next owns request headers, cookies, redirects, and auth route handlers.

`HackKitUser` is the canonical native entity in `core_user`. It stores the Better Auth identity fields and HackKit profile, role, approval, and check-in fields in one row. Better Auth maps its user model to `core_user` and its `image` field to `profilePhotoUrl`. The primary key is `id`; Core DTOs expose the same value as `authId` for domain APIs and plugin relationships. Sessions, accounts, and all domain/plugin user foreign keys reference this row.

The single `name` field is a display name supplied during signup or by a social provider. Profile settings edit that same field. HackKit does not split names or store duplicate first/last names or photos. Domain fields have safe initial values: no role, no approval or check-in, empty skills, and nullable optional profile fields. User Data and Hacker registration remain separate domain records.

Core owns the auth user model and field mapping. Auth options and plugins cannot expose HackKit domain fields through additional user fields, including aliases that map to those properties. Public signup/update payloads cannot assign role, approval, or check-in state. Those changes use authorized Core operations. Auth and Core profile edits read back from the same row without synchronization hooks or an extra identity query.

Auth fields and plugin tables must have native entity metadata before startup. Core checks the Better Auth schema requirements and rejects undeclared fields or tables. Additional auth models belong in the shared registry and need reviewed migrations.

## Consistency and side effects

Multi-step domain changes run in transactions. A portable operation-lock row serializes capacity and membership decisions before reads. Unique constraints provide additional protection. These locks trade some write concurrency for consistent behavior across supported SQL drivers.

Notification intents persist with the domain change. Workers claim pending intents with an atomic conditional update before contacting providers. Discord verification commits its linked account and consumed code before external role synchronization. External delivery is not part of a database transaction; provider failures are recorded by existing attempt tracking. An interrupted worker can leave a processing intent requiring operational recovery.

## Migrations and releases

Apps commit native MikroORM migrations and snapshots for PostgreSQL, MySQL, and SQLite; libSQL shares SQLite migrations. `hackkit db generate` creates a reviewable migration. `hackkit db migrate` explicitly applies it, and `hackkit db seed` explicitly inserts missing configured roles. Startup and plugin sync do neither.

For an entity change, generate and review each dialect's migration. Plugin removal may propose dropping tables; review retention requirements before applying that migration. This is a fresh-database redesign. The initial migration definitions now create the unified user schema for every dialect. There is no conversion of existing data or user accounts. Existing databases using the split user schema must stay untouched; use a separate fresh database for this implementation.

## Validation

The app database matrix applies committed migrations and tests real SQLite, local libSQL, PostgreSQL, MySQL, and HTTP libSQL. It checks schema agreement, signup/session/profile behavior, native JSON/date/boolean/null values, rollback, concurrent registration capacity, teams, uniqueness, and foreign-key cleanup. Package tests cover domain authorization, request isolation, notification claims, and membership conflicts. CI requires external service URLs so those cases cannot silently skip.

Use Node.js 22.17 or newer and TypeScript 5.9.3. Production validation must also cover the deployment's credentials, TLS, OAuth providers, and external email/Discord services.
