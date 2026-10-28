import { createClient, type Client, type Config } from "@libsql/client/web";
import {
	LibsqlConnection,
	LibsqlDialect,
	LibsqlDriver,
} from "@libsql/kysely-libsql";
import { CompiledQuery, SqliteAdapter, type DatabaseConnection } from "kysely";

/** Complete Kysely's savepoint API for MikroORM's nested transactions. */
class HttpLibsqlDriver extends LibsqlDriver {
	private readonly clients = new WeakMap<DatabaseConnection, Client>();
	constructor(private readonly createClient: () => Client) {
		super(createClient(), true);
	}
	// libSQL HTTP clients retain stream state. Each checkout must belong to the
	// current Worker request, while a transaction keeps its own connection.
	override async acquireConnection() {
		const client = this.createClient();
		const connection = new LibsqlConnection(client);
		this.clients.set(connection, client);
		return connection;
	}
	override async releaseConnection(connection: DatabaseConnection) {
		this.clients.get(connection)?.close();
		this.clients.delete(connection);
	}
	async savepoint(connection: DatabaseConnection, name: string) {
		await connection.executeQuery(
			CompiledQuery.raw(`savepoint "${name.replaceAll('"', '""')}"`),
		);
	}
	async rollbackToSavepoint(connection: DatabaseConnection, name: string) {
		await connection.executeQuery(
			CompiledQuery.raw(
				`rollback to savepoint "${name.replaceAll('"', '""')}"`,
			),
		);
	}
	async releaseSavepoint(connection: DatabaseConnection, name: string) {
		await connection.executeQuery(
			CompiledQuery.raw(
				`release savepoint "${name.replaceAll('"', '""')}"`,
			),
		);
	}
}

// Remote libSQL supports separate connections. Kysely's native SQLite mutex
// would otherwise make unrelated Worker requests wait on one another's I/O.
class HttpLibsqlAdapter extends SqliteAdapter {
	override get supportsMultipleConnections() {
		return true;
	}
}

export class HttpLibsqlDialect extends LibsqlDialect {
	constructor(private readonly options: Config) {
		super(options);
	}
	override createAdapter() {
		return new HttpLibsqlAdapter();
	}
	override createDriver() {
		return new HttpLibsqlDriver(() => createClient(this.options));
	}
}
