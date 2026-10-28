# HackKit minimal Next.js template

A runnable workspace example for hackathon registration and basic administration. It uses Core, Better Auth, HackKit UI, SQLite, and local file storage. It registers no plugins and needs no cloud-provider credentials.

## Setup

Use Node.js 22.17 or newer and the repository-pinned pnpm 12.15.0. From the repository root:

1. Run `corepack pnpm install`.
2. Build dependencies with `corepack pnpm exec turbo run build --filter=@hackkit/template-nextjs-minimal^...`.
3. Run `corepack pnpm --filter @hackkit/template-nextjs-minimal sync`.
4. Configure this template using `.env.example` and `hackkit.config.ts`. Use an empty SQLite development database.
5. Run `corepack pnpm --filter @hackkit/template-nextjs-minimal db:generate --name initial`.
6. Review the generated migration and snapshot, then run `corepack pnpm --filter @hackkit/template-nextjs-minimal db:migrate`.
7. Run `corepack pnpm --filter @hackkit/template-nextjs-minimal db:seed`.
8. Commit the migration and snapshot in your application repository. Run `corepack pnpm dev:minimal` and open `http://localhost:3000`.

The local `.env` starts empty and is ignored by Git. On a fresh checkout, copy [`.env.example`](.env.example) to `.env` to configure this template. The example lists production requirements and comments out optional integrations. An empty `.env` uses local development defaults. Never commit populated environment files.

Configuration belongs to this folder. Optional local overrides go in `.env.local`. Defaults use `.data/web.db` and `.data/uploads` relative to this template. Starting the app never migrates or seeds its database. Start either template individually; both development servers use port 3000.

Sign up and complete HackTag, user data, and hacker registration. Organizers can then manage users, roles, approvals, settings, and CSV exports. Owner bootstrap is explicit: assign `core.owner` to the intended user's `core_user.role_id`, selected by the canonical Better Auth `user.id`. No account becomes an owner automatically.

## Database commands

Run `corepack pnpm --filter @hackkit/template-nextjs-minimal db:<command>` from the repository root. Commands are `generate`, `migrate`, `seed`, `status`, `check`, `rollback`, and `reset`. Arguments are forwarded, for example `db:generate --name add_field` or `db:rollback --to MigrationName`.

The template ships without migration history or snapshots. Generate a baseline once during new-project setup, after choosing your configuration. Commit the reviewed SQLite migration and snapshot under `db/migrations/sqlite` in your application repository. Later clones apply this history without generating another baseline. Future entity changes produce additional migrations. Existing databases must retain the history that created them.

`HACKKIT_MIGRATIONS_PATH` optionally overrides the migration directory, relative to this application or absolute. `db:check` fails on pending migrations or schema drift. `db:reset` drops the selected database's registered tables and migration history, then migrates and seeds; it is restricted to local SQLite in development/tests. Use only disposable data for reset.

## Production

Set `NEXT_PUBLIC_APP_URL` or `BETTER_AUTH_URL` and a `BETTER_AUTH_SECRET` with at least 32 characters. `DATABASE_URL` must be a local SQLite path, such as `file:/persistent/hackkit/web.db`. Set `HACKKIT_LOCAL_BLOB_BASE_DIR=/persistent/hackkit/uploads` for uploads. Both locations must persist across application restarts. This template requires a Node server with persistent disk storage.

After building dependencies, run this template's `typecheck` and `build`, apply reviewed migrations and seed explicitly, then run its `start` command. Cloud services and plugins are configured only in the [full template](../nextjs-full/README.md).

## Validation and distribution

Repository integration tests live in [E2E](../../e2e/README.md) and execute this template's real configuration, commands, and production build against temporary storage. `corepack pnpm test:e2e` validates both templates.

This is a workspace example. Keep it inside a clone of the repository while dependencies use `workspace:*`. Standalone distribution and CLI initialization are a [later milestone](../../docs/plans/template-distribution.md).
