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

### 3. Configure local access (optional)

No environment file is required for a basic local run. Development defaults use:

-   `http://localhost:3000` for the app and Better Auth URLs
-   `file:.data/web.db` for the database
-   local storage in `.data/uploads`
-   no email provider and no Discord bot role-sync provider

To make your account an owner, create `apps/web/.env.local` before you sign up. Replace the example email with the one you will use:

```bash
cat > apps/web/.env.local <<'EOF'
HACKKIT_OWNER_EMAIL_ALLOWLIST=you@example.com
EOF
```

Alternatively, set `HACKKIT_OWNER_AUTH_ID_ALLOWLIST` to a Better Auth user ID. OAuth, email delivery, S3 storage, Turso, and Discord bot role sync are optional locally; configure them only when testing those integrations.

### 4. Generate app-owned files and apply migrations

Sync plugin-owned project files, then apply the committed migration chain to the local libSQL database:

```bash
pnpm --filter web sync
pnpm --filter web db:migrate
```

`sync` only updates plugin routes, actions, and `hackkit.lock`. It does not generate database schema or connect to a database.

Use `db:reset` when you want to discard and recreate the configured local file database:

```bash
pnpm --filter web db:reset
```

`db:reset` refuses remote URLs, removes the selected local database and its WAL/SHM files, then applies committed migrations.

### 5. Start the app

```bash
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up. If your email or auth ID is allowlisted, the app provisions your Owner role when it resolves your signed-in user. You can then use the registration, pass, check-in, and scanner routes.

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

Production requires remote persistence and explicit auth, storage, owner, and Discord configuration:

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
HACKKIT_OWNER_EMAIL_ALLOWLIST=owner@example.com
DISCORD_GUILD_ID=...
DISCORD_BOT_API_URL=https://your-discord-bot.example.com
DISCORD_INTERNAL_AUTH_KEY=...
DISCORD_PARTICIPANT_ROLE_ID=...
```

Use `DISCORD_PARTICIPANT_ROLE_NAME` instead of `DISCORD_PARTICIPANT_ROLE_ID` only when role IDs are not available. Optional email delivery is configured with `HACKKIT_EMAIL_PROVIDER=resend` plus `RESEND_API_KEY`, or `HACKKIT_EMAIL_PROVIDER=smtp` plus `SMTP_HOST` and SMTP credentials.

Run `pnpm --filter web db:migrate` as a release step before starting the new production version. Do not run migrations during the Next.js build or application startup.

## Next integration path

This app follows the single `@hackkit/next` integration path for runtime setup, page guards, Core mutations, and HackKit UI provider actions. See:

-   [`packages/next/README.md`](../../packages/next/README.md) — package API and wiring recipe
-   [`docs/guides/next-integration.md`](../../docs/guides/next-integration.md) — full guide and drift checks

## Release checks

Run the same app checks locally before deploying:

```bash
pnpm --filter web sync
pnpm --filter web schema:generate
pnpm --filter web auth:schema
pnpm --filter web db:generate
pnpm --filter web db:migrate
pnpm --filter @hackkit/core test
pnpm --filter @hackkit/db-drizzle test
pnpm --filter @hackkit/cli test
pnpm --filter @hackkit/config test
pnpm --filter @hackkit/next test
pnpm --filter @hackkit/plugin-teams test
pnpm --filter @hackkit/plugin-discord test
pnpm --filter @hackkit/plugin-notifications-email test
pnpm --filter web typecheck
pnpm --filter web build
```

CI regenerates committed schema, validates and applies migrations, runs PostgreSQL adapter integration tests, and builds the full web dependency graph.

## Server Actions

UI mutations live on the Next runtime (`runtime.mutations` from `createHackKitMutations`). Named server actions and the `hackKitUIActions` provider map ship from `@hackkit/next` — [`app/providers.tsx`](app/providers.tsx) passes `hackKitUIActions` to `HackKitUIProvider`. Plugin actions remain generated in [`app/hackkit-plugin-actions.ts`](app/hackkit-plugin-actions.ts) by `hackkit plugin sync`.

## Configuration

-   [`hackkit.config.ts`](hackkit.config.ts) — plugins, User Data options, Event Types, and the explicit database adapter
-   [`lib/runtime.ts`](lib/runtime.ts) — `createHackkitRuntimeFromConfig` composition root; use `getPageGuards()` for layouts
-   [`db/schema`](db/schema) — separately generated HackKit and Better Auth schema files
-   [`db/migrations`](db/migrations) — app-owned Drizzle migrations
