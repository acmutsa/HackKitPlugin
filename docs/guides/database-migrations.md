# Database migrations

The application owns one ordered migration history for Core, Better Auth, installed plugins, and application entities. Core supplies native entity definitions and a shared registry. The reference app supplies runnable scripts and database-specific configuration. Package authors supply reviewed transformation SQL and upgrade instructions when their schema changes require them.

The scripts live in `apps/web/scripts/database.ts`, with `scripts/db.mjs` as the Node entry point. They use MikroORM's native migrator and its `mikro_orm_migrations` history table. They do not call the HackKit CLI. Plugin route/action synchronization continues to use the existing CLI.

## Commands

Run from the repository root after installing dependencies and building workspace packages:

| Command                                                             | Behavior                                                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter web db:generate --name describe_change`              | Generates a migration and updates the target snapshot. Outputs the SQL proposal and potentially destructive statements.             |
| `pnpm --filter web db:generate --name backfill --blank`             | Creates a migration for authored SQL.                                                                                               |
| `pnpm --filter web db:status`                                       | Lists applied and pending migrations.                                                                                               |
| `pnpm --filter web db:check`                                        | Checks metadata against the snapshot, pending history, and the live schema. Exits with status 1 when any check differs.             |
| `pnpm --filter web db:migrate`                                      | Applies all pending migrations.                                                                                                     |
| `pnpm --filter web db:migrate --to Migration20261006120000_expand`  | Applies up to and including the named migration.                                                                                    |
| `pnpm --filter web db:rollback`                                     | Runs the latest applied migration's `down()` method.                                                                                |
| `pnpm --filter web db:rollback --to Migration20261006120000_expand` | Reverts later migrations, leaving the named migration applied. `--to 0` reverts all.                                                |
| `pnpm --filter web db:seed`                                         | Inserts missing configured role IDs. Existing roles and assignments remain unchanged.                                               |
| `pnpm --filter web db:reset`                                        | In development/tests, drops registered tables and migration history in the selected local SQLite database, then migrates and seeds. |

Every command accepts `--config path/to/hackkit.config.ts` and optional `--output path/to/result.json`. The output file contains the command result separately from driver diagnostics; a failed `check` still writes its result and exits with status 1. The entry point loads `.env` files with Next's environment precedence before loading the config. Explicit shell environment variables take precedence. Configuration paths and relative database paths are resolved from the application directory.

The selected dialect determines the migration directory. PostgreSQL, MySQL, and SQLite have separate histories in `apps/web/db/migrations`; libSQL uses the SQLite history. Generate and test each supported history when changing a shared entity. A generated migration for one dialect is not a replacement for the other dialects' histories.

`status` and `check` use native migration history APIs. These APIs may create the tracking table if it does not exist. They do not apply application migrations or seed data. A database connection failure is an error, not a successful status check. Generation can use a committed snapshot without connecting; without a snapshot, MikroORM needs a database for its starting schema.

`check` compares schema and migration names, not application data or migration checksums. A clean result cannot prove that a backfill produced the intended values. Historical migration sources must stay immutable after application.

## Change an entity

1. Change Core, plugin, or application entities. Keep every installed entity in the shared registry.
2. Select the dialect and a disposable development database. Run `db:generate --name describe_change`.
3. Review the complete migration, including generated `down()` and snapshot changes. Inspect dropped tables/columns and SQLite table rebuilds. The destructive-statement output is a review aid, not a complete SQL analysis.
4. Add required data transformations as authored SQL. Schema generation cannot infer renames or the meaning of existing values.
5. Apply the history to a fresh database. Separately apply it to the previous version's schema with representative existing data.
6. Verify IDs, foreign keys, transformed data, auth sessions, schema agreement, and zero pending migrations. Run `db:check` against the completed target schema.
7. Commit the reviewed migration sources and snapshots together.

Snapshots describe the generated target schema. The reference app sets `snapshotOnMigrate: false`: applying or rolling back migrations does not rewrite them. After a rollback, reapply the existing migration instead of generating it again. During a staged upgrade, the live schema can deliberately differ from the final snapshot; run the final `check` after the last stage.

## Transform existing data

Use an explicit sequence when adding a required field or replacing existing fields:

1. **Expand:** generate a migration that adds the new field as nullable while retaining the old fields.
2. **Backfill:** create a blank migration and author SQL that copies/transforms existing data. Validate nulls, empty values, Unicode, and relationships.
3. **Contract:** after compatible code is deployed and the transformation is verified, generate the final constraints and removal of obsolete fields.

A staged release applies through the expansion/backfill boundary with `--to`. Deploy code that can use the expanded schema, then apply contraction when the old code no longer needs the legacy fields. A single maintenance-window release can apply the full reviewed chain when downtime and the compatibility plan permit it.

Historical migrations should use `this.addSql()` or `this.execute()` with static SQL. Avoid importing current entities or calling current domain APIs in migration files: those definitions change after the migration was authored. Package upgrade guidance must state the source version, target version, SQL ordering, dialect coverage, and recovery behavior. See [the package upgrade contract](package-schema-upgrades.md).

## Disable a plugin and retain its data

Keep the plugin registered and set `enabled: false`:

```ts
plugins: [
  { ...teamsPlugin(), enabled: false }, // 1
  discordPlugin(() => ({              // 2
    guildId: env.discordGuildId,
    roleSyncProvider: createDiscordRoleSyncProvider(),
  })),
],
```

1. Core keeps the Teams entity definitions, settings, and permissions in the registry. It skips the plugin's setup function. Accessing `hackkit.plugins.teams` throws a structured `INVALID_OPERATION` error. Check `hackkit.isPluginEnabled("teams")` before exposing optional functionality.
2. Provider options are evaluated once when the enabled plugin first sets up its API. Entity discovery and migration commands do not initialize providers. Discord and email plugin factories accept either existing options objects or lazy options functions.

Runtime and migrations collect disabled plugin entities identically. Disabling a plugin therefore does not propose table drops. Re-enabling it uses the retained data. Keeping a disabled plugin installed also keeps its schema current when its package is upgraded; disabling behavior does not freeze old entity definitions.

The built-in Teams/Discord pages return 404 when disabled, and their actions return structured failures. The reference app hides their navigation links. Custom routes, jobs, and UI should use the same enabled check. Do not cache a plugin API across config changes; runtime scopes use the config from application startup.

Removing the plugin from `plugins` is an uninstall proposal. Generation may propose dropping its tables. If retention is required while removing its executable package, keep stable native definitions of those tables through the application's `entities` option. Otherwise, review and explicitly apply a destructive uninstall migration. Disabling and uninstalling are separate configuration choices.

The CLI package is unchanged. Its current sync command can still materialize wrappers for disabled plugins. The runtime guards prevent those wrappers from invoking disabled APIs. Future CLI integration can hide disabled route/action wrappers while continuing to collect their entities; that work must preserve this contract.

## Deployment and failure recovery

Apply migrations from one explicit Node release job with the application's selected configuration and credentials. Do not run them during request handling, app startup, or builds. Workers applications can use a separate Node migration job; these scripts do not establish Workers runtime compatibility or hosted Turso readiness.

SQLite, PostgreSQL, and libSQL use native transaction settings. The reference MySQL configuration sets `transactional: false` and `allOrNothing: false` because MySQL DDL commits implicitly. A failure can leave partial DDL without an applied history entry. Inspect the failed statement, existing schema, and any committed data transformations before retrying. Do not assume that a missing history entry means that nothing changed.

A `down()` method is a schema reversal, not a backup. Dropping a column can lose values permanently, and generated reversal SQL can fail to restore a required field on populated tables. Review and test rollback only when it is a supported recovery path. Otherwise, document restoration or a forward repair before release.

Reset rejects production and all non-SQLite drivers, including local libSQL. It drops the registered application tables and tracking table; unrelated, unregistered tables are not part of the reset contract. It never deletes another database file. Use it only for disposable development data.

## Validation

`pnpm --filter web test` exercises the app scripts against SQLite/local libSQL. It checks existing-data expansion/backfill/contraction, staged migration, plugin upgrade, rollback/reapply, live drift, disabled-schema retention, destructive uninstall proposals, fresh replay, and reset/seed behavior.

`pnpm --filter web test:db-matrix` runs the same upgrade flow after auth/domain validation on each configured target. CI requires PostgreSQL, MySQL, and HTTP libSQL URLs; missing local targets are reported as skipped. Test URLs must name empty, disposable databases. The native libSQL client can hang when repeatedly creating and destroying ORM instances in one Node process. The HTTP upgrade test uses one Node process per command, matching the utility scripts’ release-job lifecycle. Do not run a sequence of these commands inside a long-lived application process. Hosted Turso authentication/TLS and deployment-specific runtime behavior need separate validation.

Primary reference: [MikroORM 7.2 migrations](https://mikro-orm.io/docs/migrations).
