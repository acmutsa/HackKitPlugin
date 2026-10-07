# Publish a Core or plugin schema upgrade

Applications compose Core, auth, plugin, and app tables into one migration history. Core and plugins publish native entity definitions. When an entity change needs a data transformation, package maintainers must also publish an upgrade note and tested static SQL for each supported dialect.

Store that guidance beside the package's release documentation. Keep the SQL reviewable and identify its order relative to generated schema changes. Do not ship an independent migrator, package history table, or automatic upgrade coordinator.

## Required upgrade note

Use this checklist for each schema-changing release:

-   **Versions:** exact supported source versions and target version. State whether intermediate versions must be installed first.
-   **Entities:** added/removed/changed tables, fields, constraints, and foreign-key relationships.
-   **Expansion:** schema changes needed before the transformation, including temporary nullable fields or defaults.
-   **Transformation:** static SQL with expected input/output values, handling of nulls, empty values, and invalid legacy data. State whether rerunning is safe.
-   **Contraction:** final constraints and removals. State when old code must stop running.
-   **Application integration:** tell developers where to insert each step in their own history. Describe dependencies on other Core/plugin/app tables. Include the `db:migrate --to` boundaries where applicable.
-   **Verification:** expected schema and data assertions. Record passed versions for PostgreSQL, MySQL, SQLite, and libSQL separately; explicitly list skipped or unvalidated targets.
-   **Recovery:** supported `down()` behavior, irreversible data loss, and partial-DDL handling. MySQL must have an explicit recovery plan for failed DDL.
-   **Disabled plugins:** state whether the release changes retained schema. `enabled: false` retains entities and still participates in package schema upgrades.

Use the package's frozen historical SQL in test fixtures. Apply the upgrade to the previous schema with existing Core users, plugin foreign keys, and application-owned references. Also replay the complete consuming application's history into an empty database using only current metadata.

## Application integration

The application developer installs the new package, generates the expansion against its complete registry, inserts/adapts the package's authored transformation SQL, then generates contraction. The application commits every step and the final dialect snapshot together. Package SQL is an input to that review; it is not automatically applied when the package is installed.

If an application customizes affected fields, relations, or naming, it must adapt and test the SQL before release. The package note should call out those assumptions. A clean schema diff does not verify transformed data.

The reference app's upgrade tests demonstrate this workflow with synthetic application fields and a plugin linked to real `core_user` records. They prove the migration runner's composition and ordering; each actual package release still needs tests for its specific transformation.

See [database migrations](database-migrations.md) for commands, snapshots, plugin retention, and deployment behavior.
