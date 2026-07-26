# web

Production-ready **HackKit Web App** for Better Auth, libSQL/Turso, HackKit UI flows, Teams, RSVP, Discord verification, and notifications.

## Local setup

Run every command below from the repository root.

### 1. Install prerequisites and dependencies

-   Node.js 20.x
-   pnpm 8.3.1

The repository enforces pnpm through `preinstall`.

```bash
pnpm install
```

### 2. Build the workspace dependencies

Build the packages that `web` imports before running commands that use the `hackkit` CLI:

```bash
pnpm exec turbo run build --filter=web^...
```

This builds the CLI, database adapter, and other workspace packages that the app imports. `dev` repeats this dependency build.

### 3. Configure local integrations (optional)

No environment file is required for a basic local run. Development defaults use:

-   `http://localhost:3000` for the app and Better Auth URLs
-   `file:.data/web.db` for the database
-   local storage in `.data/uploads`
-   no email provider and no Discord bot role-sync provider

OAuth, email delivery, S3 storage, Turso, and Discord bot role sync are optional locally; configure them only when testing those integrations.

### 4. Generate app-owned files and apply migrations

Sync plugin-owned routes, regenerate the unified Better Auth schema when plugin storage changes, and apply the committed migration chain:

```bash
pnpm --filter web sync
pnpm --filter web auth:schema
pnpm --filter web db:migrate
```

`sync` only updates plugin routes and `hackkit.lock`. Better Auth owns schema generation; the app owns Drizzle migrations.

Use `db:reset` when you want to discard and recreate the configured local file database:

```bash
pnpm --filter web db:reset
```

`db:reset` refuses remote URLs, removes the selected local database and its WAL/SHM files, and applies committed migrations.

### 5. Start the app

```bash
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up. The app migration creates the participant and owner roles. To bootstrap the first owner for now, assign the owner role on the Better Auth user row:

```sql
UPDATE user
SET role_id = 'core.owner'
WHERE id = '<better-auth-user-id>';
```

The runtime does not infer ownership from an email address or auth ID.

### 6. Optional local checks

Run the full app verification path before handing off a change:

```bash
pnpm --filter web verify
```

`verify` runs:

```bash
pnpm sync
pnpm typecheck
pnpm build
```

From the repo root, those map to the filtered `web` scripts. `typecheck` also builds `@hackkit/cli` first because the `hackkit` binary is needed by app scripts.

## Schema and migration workflow

HackKit, Better Auth, and application schemas are separate files under `db/schema`. Regenerate only the owner that changed:

```bash
pnpm --filter web schema:generate # Core or plugin storage changed
pnpm --filter web auth:schema     # Better Auth config/plugins changed
```

Both generated files are committed. After reviewing their diffs, let Drizzle generate and apply the migration:

```bash
pnpm --filter web db:generate --name=describe-change
pnpm --filter web db:migrate
```

Review and commit the generated SQL and metadata. HackKit never generates or applies these migrations. `dev` does not inspect or initialize the database; a missing migration surfaces through the first database operation.

## Build dependency graph

Build every workspace package that web transitively requires before
building the app:

```bash
pnpm exec turbo run build --filter=web^...
pnpm --filter web build
```

Turbo derives that dependency set from `apps/web/package.json`; add every
runtime or build-time workspace import there. CI runs the same graph command
before its production-configured web build.

## Production setup

Production requires remote persistence and explicit auth, storage, and Discord configuration:

```bash
DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NEXT_PUBLIC_APP_URL=https://your-app.example.com
BETTER_AUTH_URL=https://your-app.example.com
BETTER_AUTH_SECRET=at-least-32-characters
BETTER_AUTH_TRUSTED_ORIGINS=https://your-app.example.com
HACKKIT_BLOB_ADAPTER=s3
HACKKIT_S3_BUCKET=...
HACKKIT_S3_REGION=...
HACKKIT_S3_ENDPOINT=...
HACKKIT_S3_ACCESS_KEY_ID=...
HACKKIT_S3_SECRET_ACCESS_KEY=...
DISCORD_GUILD_ID=...
DISCORD_BOT_API_URL=https://your-discord-bot.example.com
DISCORD_INTERNAL_AUTH_KEY=...
DISCORD_PARTICIPANT_ROLE_ID=...
```

Use `DISCORD_PARTICIPANT_ROLE_NAME` instead of `DISCORD_PARTICIPANT_ROLE_ID` only when role IDs are not available. Optional email delivery is configured with `HACKKIT_EMAIL_PROVIDER=resend` plus `RESEND_API_KEY`, or `HACKKIT_EMAIL_PROVIDER=smtp` plus `SMTP_HOST` and SMTP credentials.

Run `pnpm --filter web auth:schema`, generate an app-owned Drizzle migration, and apply it before starting a new production version.

## Better Auth integration path

[`lib/auth.ts`](lib/auth.ts) is the only server composition root. It instantiates Better Auth with `hackkit(appConfig)`, and server components/actions call named `auth.api.*` endpoints. [`lib/auth-client.ts`](lib/auth-client.ts) creates the browser client with `hackkitClient()` so those endpoints are inferred on the client too.

## Release checks

Run the same app checks locally before deploying:

```bash
pnpm --filter web sync
pnpm --filter web schema:generate
pnpm --filter web auth:schema
pnpm --filter web db:generate
pnpm --filter web db:migrate
pnpm --filter @hackkit/core test
pnpm --filter @hackkit/cli test
pnpm --filter @hackkit/config test
pnpm --filter @hackkit/auth-better-auth test
pnpm --filter @hackkit/plugin-teams test
pnpm --filter @hackkit/plugin-discord test
pnpm --filter @hackkit/plugin-notifications-email test
pnpm --filter web typecheck
pnpm --filter web build
```

CI regenerates committed schema, validates and applies the web migration chain, runs a Better Auth flow against the generated auth schema, verifies database-command isolation, applies the committed PostgreSQL adapter migration fixture, and builds the full web dependency graph.

## Server Actions

App-owned Server Actions in [`app/_hackkit/server-actions.ts`](app/_hackkit/server-actions.ts) call explicit Better Auth endpoints and are passed to `HackKitUIProvider`. Plugin UI actions follow the same pattern in [`app/hackkit-plugin-actions.ts`](app/hackkit-plugin-actions.ts); route sync does not generate a second runtime/action bridge.

## Configuration

-   [`hackkit.config.ts`](hackkit.config.ts) — plugin and HackKit domain options
-   [`lib/auth.ts`](lib/auth.ts) — Better Auth composition root that loads `hackkit(appConfig)`
-   [`lib/auth-client.ts`](lib/auth-client.ts) — browser Better Auth client with `hackkitClient()`
-   [`lib/hackkit-server.ts`](lib/hackkit-server.ts) — app-owned header and route-guard helpers over named endpoints
-   [`db/schema`](db/schema) — one Better Auth-generated schema containing auth and HackKit models
-   [`db/migrations`](db/migrations) — app-owned Drizzle migrations
