# Let database adapters generate native schema and applications own migrations

HackKit Core owns an adapter-neutral Storage Schema, but it does not own an ORM schema format or a migration engine. Concrete database adapters compile merged Core and plugin storage into their ecosystem's native schema source. The application commits that generated source and uses its native database tooling to generate, review, and apply migrations.

The ownership chain is:

```txt
HackKit Core Storage Schema
  -> adapter-owned native schema generator
  -> committed HackKit schema file
  -> app-owned native migration tool
  -> app-owned migration history and deployment step
```

Runtime persistence and schema generation are capabilities of the same configured `DatabaseAdapterFactory`, while migration management remains outside HackKit:

```ts
export type DatabaseAdapterFactory = {
	create(context: DatabaseAdapterFactoryContext): DatabaseAdapter;
	schema?: DatabaseSchemaAdapter;
};

export type DatabaseSchemaAdapter = {
	id: string;
	generateSchemaFiles(input: {
		storage: StorageRegistry;
	}): GeneratedSchemaFile[] | Promise<GeneratedSchemaFile[]>;
};
```

The HackKit CLI exposes native schema generation and explicit configured-data seeding:

```bash
hackkit db schema generate --output db/schema/hackkit.ts
hackkit db seed
```

`hackkit db seed` connects through the configured database adapter and idempotently inserts the roles declared in `seedRoles`. It does not update or delete existing roles, assign roles to users, or run during application startup.

The CLI does not diff schemas, create migration files, apply migrations, inspect migration state, baseline existing databases, or provide rollback behavior. If the configured adapter does not expose `schema`, generation fails with a clear unsupported-capability error.

For Drizzle applications, `@hackkit/db-drizzle` provides SQLite/libSQL and PostgreSQL entrypoints. Drizzle Kit reads the generated HackKit file alongside separately owned schema files, such as Better Auth's CLI-generated schema and developer-authored application tables. Drizzle Kit then owns migration generation and application.

Generated schema files have separate ownership and must not overwrite one another:

```txt
db/schema/hackkit.ts  # HackKit CLI
db/schema/auth.ts     # Better Auth CLI
db/schema/app/*.ts    # application developers
```

Schema generation is explicit and is not part of general plugin file sync. Plugin add/remove commands regenerate the HackKit schema because those operations directly change registered storage. Other storage changes require the developer to run the schema command. Generated native schema and native migration artifacts are committed and checked for drift in CI.

Applications apply migrations and configured seed data explicitly in local setup and deployment release steps. HackKit and application startup do not automatically create, inspect, migrate, or seed database objects; an unprepared database fails through its first ordinary database operation.
