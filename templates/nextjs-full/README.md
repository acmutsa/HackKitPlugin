# HackKit reference web app

Next.js app using MikroORM, Core-owned Better Auth, HackKit UI, Teams, Discord verification, and notifications. This migration targets a fresh database. Existing databases and user accounts are not converted.

## Local setup

Use Node.js 22.17 or newer and the repository-pinned pnpm 12.15.0. Run these commands from the repository root:

1. Install dependencies with `pnpm install`.
2. Build workspace packages with `pnpm exec turbo run build --filter=@hackkit/template-nextjs-full^...`.
3. Sync plugin routes with `pnpm --filter @hackkit/template-nextjs-full sync`.
4. Apply committed migrations with `pnpm --filter @hackkit/template-nextjs-full db:migrate`.
5. Insert configured roles with `pnpm --filter @hackkit/template-nextjs-full db:seed`.
6. Start Next.js with `pnpm --filter @hackkit/template-nextjs-full dev`.

The local `.env` starts empty and is ignored by Git. On a fresh checkout, copy [`.env.example`](.env.example) to `.env` to configure this template. The example lists production requirements and comments out optional integrations. An empty `.env` uses local development defaults. Never commit populated environment files.

Development defaults use `http://localhost:3000`, SQLite at `templates/nextjs-full/.data/web.db`, and local blob storage. OAuth, email, and Discord providers are optional locally. The runtime does not migrate or seed on startup. Plugin sync only updates routes and `hackkit.lock`.

After signup, bootstrap an owner explicitly by assigning `core.owner` to that user's `role_id` in `core_user`, selected by `id`. Better Auth's `user.id` is the canonical ID. The runtime does not infer ownership from email.

`pnpm --filter @hackkit/template-nextjs-full db:reset` drops registered tables and migration history in the selected local SQLite database, then migrates and seeds. It refuses production and non-SQLite drivers. Never use it for data you need to retain.

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

Core, Better Auth, installed plugins (including disabled plugins), and application entities form one native MikroORM registry. Add app-owned `defineEntity` definitions through `entities` in `hackkit.config.ts`; plugins expose an `entities` array. Runtime and app migration scripts use the same registry. Auth plugins requiring extra tables or fields must declare them before initialization; undeclared schema fails early.

Migrations and snapshots are committed under `db/migrations/postgresql`, `db/migrations/mysql`, and `db/migrations/sqlite`. libSQL uses the SQLite chain. After changing entities:

1. Select a disposable development database for the dialect using the variables above.
2. Run `pnpm --filter @hackkit/template-nextjs-full db:generate --name describe-change`.
3. Review the generated TypeScript migration and snapshot. Repeat generation for the other dialects.
4. Apply with `pnpm --filter @hackkit/template-nextjs-full db:migrate` and validate against fresh databases.
5. Commit every dialect's reviewed migration and snapshot.

Set `enabled: false` on a registered plugin to disable behavior while keeping its schema and data. Removing it can generate table drops. Review data retention before applying them. `db:seed` only inserts missing configured role IDs; it does not update existing roles or assign them to users.

The database commands now use application-owned utility scripts, independently of the CLI. Use `db:status`, `db:check`, staged `db:migrate --to`, `db:rollback`, and `db:generate --blank` for upgrades. See [the migration guide](../../docs/guides/database-migrations.md) for exact commands, data transformations, MySQL recovery, and plugin retention.

## Authentication and request scope

[lib/auth-options.ts](lib/auth-options.ts) supplies secrets, origins, and OAuth providers. Core owns Better Auth construction, native entities, and the pinned community adapter. Better Auth identity and HackKit profile fields share the canonical `core_user` row.

[lib/runtime.ts](lib/runtime.ts) initializes shared connections and registers a function that creates request-scoped domain APIs. Next owns cookies, headers, guards, and redirects. Browser mutations use the package-owned HTTP handler and return JSON DTOs. Browser code uses `@hackkit/core/client`; it does not import the ORM.

## Production configuration

Set explicit `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET` (at least 32 characters). Configure `BETTER_AUTH_TRUSTED_ORIGINS` as a comma-separated list when needed. The app's production checks also require:

-   `HACKKIT_BLOB_ADAPTER=s3`, bucket, region, access key, and secret key; set `HACKKIT_S3_ENDPOINT` for compatible stores.
-   `DISCORD_GUILD_ID`, `DISCORD_BOT_API_URL`, `DISCORD_INTERNAL_AUTH_KEY`, and `DISCORD_PARTICIPANT_ROLE_ID` (or role name).
-   Optional email through `HACKKIT_EMAIL_PROVIDER=resend` plus `RESEND_API_KEY`, or `smtp` plus SMTP settings.

See [env.ts](env.ts) for exact variable names. Database storage must persist across application restarts. Apply migrations and seed as explicit release steps. Builds must have valid configuration but do not apply schema changes.

## Validation

Integration tests now live in [E2E](../../e2e/README.md). From the repository root, run `corepack pnpm test:e2e:db` for database workflows and the configured driver matrix, `corepack pnpm test:e2e:http` for production HTTP checks, or `corepack pnpm test:e2e:browser` for browser journeys. `corepack pnpm test:e2e` runs all suites. Every run uses disposable storage. CI requires PostgreSQL, MySQL, and HTTP libSQL in addition to SQLite and local libSQL.

Package behavior tests remain beside their packages and run through `corepack pnpm test`. The template's `verify` command syncs plugin files, typechecks, and builds after dependencies and production configuration are ready.

## Distribution

This is a runnable workspace example. Packages remain private and use workspace dependencies. [Standalone distribution and CLI init](../../docs/plans/template-distribution.md) are deferred. The [minimal template](../nextjs-minimal/README.md) provides Core registration and basic administration with SQLite and local uploads.

## Architecture

-   [Next integration guide](../../docs/guides/next-integration.md)
-   [MikroORM and Core auth decision](../../docs/adr/0013-mikroorm-and-core-auth.md)
-   [hackkit.config.ts](hackkit.config.ts): plugins, database, auth, settings, and seed roles.
-   [db/migrations](db/migrations): reviewed app-owned migrations.

The UI provider receives a typed better-call path client created at module scope in `app/providers.tsx`. Plugin components bind their endpoint types using the provider's HTTP settings. `hackkit plugin sync` installs page reexports and updates `hackkit.lock`; it generates no client metadata. The single `/api/hackkit/[...path]` route forwards POST to the host handler. No app-level action wrappers or action maps are needed.
