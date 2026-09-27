# HackKit reference web app

Next.js app using MikroORM, Core-owned Better Auth, HackKit UI, Teams, Discord verification, and notifications. This migration targets a fresh database. Existing databases and user accounts are not converted.

## Local setup

Use Node.js 22.17 or newer and pnpm 8.3.1. Run these commands from the repository root:

1. Install dependencies with `pnpm install`.
2. Build workspace packages with `pnpm exec turbo run build --filter=web^...`.
3. Sync plugin routes and actions with `pnpm --filter web sync`.
4. Apply committed migrations with `pnpm --filter web db:migrate`.
5. Insert configured roles with `pnpm --filter web db:seed`.
6. Start Next.js with `pnpm --filter web dev`.

Development defaults use `http://localhost:3000`, SQLite at `apps/web/.data/web.db`, and local blob storage. OAuth, email, and Discord providers are optional locally. The runtime does not migrate or seed on startup. Plugin sync only updates routes, actions, and `hackkit.lock`.

After signup, bootstrap an owner explicitly by assigning `core.owner` to that user's `role_id` in `core_user`, selected by `auth_id`. Better Auth's `user.id` is the canonical ID. The runtime does not infer ownership from email.

`pnpm --filter web db:reset` discards only the selected `file:` database and its WAL/SHM files, then migrates and seeds. It refuses remote URLs. Never use it for data you need to retain.

## Database selection

| Driver                 | DATABASE_URL                               | HACKKIT_DATABASE_DIALECT           |
| ---------------------- | ------------------------------------------ | ---------------------------------- |
| SQLite                 | `file:.data/web.db`                        | `sqlite` (default for local paths) |
| local libSQL           | `file:.data/web.db`                        | `libsql` (explicit)                |
| network libSQL / Turso | `libsql://...` or `https://...`            | `libsql` (inferred)                |
| PostgreSQL             | `postgresql://user:password@host/database` | `postgresql` (inferred)            |
| MySQL                  | `mysql://user:password@host/database`      | `mysql` (inferred)                 |

Set `TURSO_AUTH_TOKEN` when the libSQL endpoint requires authentication. Driver options live in [lib/database-config.ts](lib/database-config.ts).

## Entity and migration workflow

Core, Better Auth, enabled plugins, and application entities form one native MikroORM registry. Add app-owned `defineEntity` definitions through `entities` in `hackkit.config.ts`; plugins expose an `entities` array. Runtime and CLI use the same registry. Auth plugins requiring extra tables or fields must declare them before initialization; undeclared schema fails early.

Migrations and snapshots are committed under `db/migrations/postgresql`, `db/migrations/mysql`, and `db/migrations/sqlite`. libSQL uses the SQLite chain. After changing entities:

1. Select a disposable development database for the dialect using the variables above.
2. Run `pnpm --filter web db:generate --name describe-change`.
3. Review the generated TypeScript migration and snapshot. Repeat generation for the other dialects.
4. Apply with `pnpm --filter web db:migrate` and validate against fresh databases.
5. Commit every dialect's reviewed migration and snapshot.

Removing a plugin can generate table drops. Review data retention before applying them. `db:seed` only inserts missing configured role IDs; it does not update existing roles or assign them to users.

## Authentication and request scope

[lib/auth-options.ts](lib/auth-options.ts) supplies secrets, origins, and OAuth providers. Core owns Better Auth construction, native entities, the pinned community adapter, and atomic profile creation. Auth owns email; profile edits are stored separately and survive later session reads.

[lib/runtime.ts](lib/runtime.ts) initializes shared connections and registers a function that creates request-scoped domain APIs. Next owns cookies, headers, guards, and redirects. Server actions return plain DTOs. Browser code uses `@hackkit/core/client`; it does not import the ORM.

## Production configuration

Set explicit `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET` (at least 32 characters). Configure `BETTER_AUTH_TRUSTED_ORIGINS` as a comma-separated list when needed. The app's production checks also require:

-   `HACKKIT_BLOB_ADAPTER=s3`, bucket, region, access key, and secret key; set `HACKKIT_S3_ENDPOINT` for compatible stores.
-   `DISCORD_GUILD_ID`, `DISCORD_BOT_API_URL`, `DISCORD_INTERNAL_AUTH_KEY`, and `DISCORD_PARTICIPANT_ROLE_ID` (or role name).
-   Optional email through `HACKKIT_EMAIL_PROVIDER=resend` plus `RESEND_API_KEY`, or `smtp` plus SMTP settings.

See [env.ts](env.ts) for exact variable names. Database storage must persist across application restarts. Apply migrations and seed as explicit release steps. Builds must have valid configuration but do not apply schema changes.

## Validation

Build dependencies before tests. Run `pnpm --filter web test` for the committed SQLite migration and auth flow. `pnpm --filter web test:db-workflow` verifies that sync does not connect and reset affects only its selected file. `pnpm --filter web verify` syncs generated files, typechecks, and builds Next.js. After building, `pnpm --filter web test:runtime` starts the production server on loopback port 33017 with an isolated temporary SQLite database, verifies HTTP auth and access control, then stops the server and removes its test data.

`pnpm --filter web test:db-matrix` always runs SQLite and local libSQL. For the complete matrix, supply URLs for **empty, disposable** databases:

-   `HACKKIT_TEST_POSTGRESQL_URL`
-   `HACKKIT_TEST_MYSQL_URL`
-   `HACKKIT_TEST_LIBSQL_URL` (a real HTTP/libSQL server)
-   `HACKKIT_REQUIRE_DATABASE_MATRIX=1` to fail if any URL is missing.

The matrix writes test accounts and domain records; it never drops the target database. Use fresh databases for every run. CI requires all five targets, checks schema agreement, runs package tests, typechecks, and builds Next.js. External OAuth, hosted Turso credentials/TLS, and real email/Discord delivery require deployment-specific validation.

## Architecture

-   [Next integration guide](../../docs/guides/next-integration.md)
-   [MikroORM and Core auth decision](../../docs/adr/0013-mikroorm-and-core-auth.md)
-   [hackkit.config.ts](hackkit.config.ts): plugins, database, auth, settings, and seed roles.
-   [db/migrations](db/migrations): reviewed app-owned migrations.

UI mutations and `hackKitUIActions` ship from `@hackkit/next`. Plugin server actions in `app/hackkit-plugin-actions.ts` are generated by `hackkit plugin sync` and share the same request runtime.
