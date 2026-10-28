import { SqliteDriver } from "@mikro-orm/sqlite";
export default {
	database: { driver: SqliteDriver, dbName: ":memory:" },
	auth: {},
};
