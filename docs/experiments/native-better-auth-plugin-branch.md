# Native Better Auth plugin experiment

This document describes the `codex/better-auth-plugin-rewrite` branch. The branch is an intentional hard-cutover experiment: HackKit no longer creates a standalone runtime beside Better Auth. Instead, the application loads HackKit as a native Better Auth server plugin and uses Better Auth as the runtime boundary for sessions, identity, persistence, schema, endpoints, and client inference.

The experiment deliberately supersedes architecture decisions that depended on `@hackkit/next`, a public HackKit runtime, HackKit database configuration, or separately generated HackKit schema.

## Architecture

The web application has one server composition root:

```ts
export const auth = betterAuth({
	database: drizzleAdapter(getDb(), {
		provider: "sqlite",
		schema,
		camelCase: true,
	}),
	plugins: [hackkit(appConfig), nextCookies()],
});
```

`hackkit(appConfig)` contributes all Core and installed-extension models to Better Auth. During plugin initialization, HackKit privately adapts Better Auth's database context to the domain implementation. The domain object is not exposed to application code.

Authenticated operations are explicit Better Auth endpoints such as:

-   `auth.api.getHackkitMe`
-   `auth.api.updateHackkitProfile`
-   `auth.api.listHackkitEvents`
-   `auth.api.setManyHackkitSettings`
-   `auth.api.createHackkitTeam`

Session middleware supplies the acting user. Callers cannot provide an actor ID to impersonate another user.

The browser client loads the inference companion:

```ts
export const authClient = createAuthClient({
	plugins: [hackkitClient()],
});
```

This gives Better Auth's client knowledge of the HackKit endpoint surface without creating a second client-side runtime.

## Important entrypoints

-   `packages/auth-better-auth/src/index.ts` defines the server plugin and initializes the private domain implementation.
-   `packages/auth-better-auth/src/schema.ts` converts Core and installed-extension models into Better Auth plugin schema.
-   `packages/auth-better-auth/src/database.ts` implements the private persistence bridge over Better Auth's adapter context.
-   `packages/auth-better-auth/src/endpoints.ts` defines the named server endpoint surface and session-derived authorization boundaries.
-   `packages/auth-better-auth/src/client.ts` defines the Better Auth client inference companion.
-   `apps/web/lib/auth.ts` instantiates the production Better Auth server.
-   `apps/web/lib/auth-client.ts` instantiates the browser auth client.
-   `apps/web/better-auth.config.ts` instantiates the schema-generation version of Better Auth.

## Schema and migrations

Better Auth generates one unified Drizzle schema containing:

-   Better Auth tables and user fields;
-   HackKit Core models;
-   models from installed HackKit extensions such as Teams, Discord, and email notifications.

The generated schema is committed at `apps/web/db/schema/auth.ts`. The application remains responsible for reviewing schema changes and generating, applying, and owning migrations. HackKit does not migrate or seed the database at runtime.

The initial application migration also creates `core.owner` and `core.participant`. Compound indexes that Better Auth plugin schema cannot express are maintained in the app-owned SQL migration.

## Installed HackKit extensions

Teams, Discord, and email notifications remain HackKit domain extensions nested inside the HackKit Better Auth plugin. Their models are folded into the unified Better Auth schema. Their named endpoints are installed only when the corresponding extension is present in `hackkit.config.ts`, and the inferred server API follows that installed plugin tuple.

Plugin route synchronization remains in the HackKit CLI. The CLI no longer generates action bridges, database schema, migrations, or seed commands.

## Removed seams

The hard cutover removes:

-   the standalone web `runtime.ts` composition path;
-   generic `callHackkit` RPC dispatch;
-   `@hackkit/next` runtime, guards, mutations, and action maps;
-   `@hackkit/db-drizzle` and its dialect-specific runtime adapters;
-   separate generated HackKit schema files;
-   HackKit CLI schema and role-seeding commands;
-   plugin action-factory metadata and lockfile action entries.

Next.js pages and server actions now call named `auth.api.*` methods directly. Small app-owned helpers remain for acquiring request headers, applying page guards, validating QR payloads, and adapting endpoint results to reusable UI action contracts.

## Follow-up fixes on this branch

The branch includes regression fixes discovered during live testing:

-   app-relative profile-picture URLs are accepted consistently during both profile updates and Better Auth session rehydration;
-   permission validation accepts declared camel-cased keys such as `core.users.checkIn`;
-   authenticated QR TTL and maximum-team-size setting updates continue to work after saving an app-relative profile picture.

These scenarios are covered by the native plugin integration tests.

## Running the experiment

From the repository root:

```bash
pnpm install
pnpm --filter web db:reset
pnpm --filter web dev
```

`db:reset` deletes and recreates the local SQLite database, so do not use it when local data must be retained. No environment file is required for the default local setup. Open `http://localhost:3000`, create an account, and assign `core.owner` to the local user when organizer access is needed.

## Validation

The branch has been checked with:

```bash
pnpm -r --if-present test
pnpm -r --if-present typecheck
pnpm --filter web auth:schema
pnpm --filter web db:generate
pnpm --filter web build
```

The committed migration was also applied to a fresh SQLite database. The native Better Auth integration suite covers schema contribution, explicit endpoint registration, session-derived identity, profile persistence, role permissions, numeric settings, extension model installation, client inference, and schema-name collision handling.

## Experiment boundary

Core still contains the reusable domain implementation and its model vocabulary, but applications no longer construct or configure it. It is an implementation detail initialized by the Better Auth plugin. This keeps the rewrite reviewable while testing the central design claim: HackKit's public runtime can be the Better Auth plugin rather than a framework that embeds Better Auth.
