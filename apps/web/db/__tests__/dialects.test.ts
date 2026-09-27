import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { LibSqlDriver } from "@mikro-orm/libsql";
import { MySqlDriver } from "@mikro-orm/mysql";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { runDbMigrate, runDbSeed } from "@hackkit/cli";
import {
	AuthUser,
	CoreSetting,
	coreModels,
	initializeHackkit,
	type HackKitDatabaseOptions,
} from "@hackkit/core";
import appConfig from "../../hackkit.config";

const externalTargets = [
	{
		name: "PostgreSQL",
		dialect: "postgresql",
		driver: PostgreSqlDriver,
		url: process.env.HACKKIT_TEST_POSTGRESQL_URL,
	},
	{
		name: "MySQL",
		dialect: "mysql",
		driver: MySqlDriver,
		url: process.env.HACKKIT_TEST_MYSQL_URL,
	},
	{
		name: "network libSQL",
		dialect: "sqlite",
		driver: LibSqlDriver,
		url: process.env.HACKKIT_TEST_LIBSQL_URL,
	},
];
if (
	process.env.HACKKIT_REQUIRE_DATABASE_MATRIX === "1" &&
	externalTargets.some((target) => !target.url)
) {
	throw new Error(
		"The required database matrix needs PostgreSQL, MySQL, and network libSQL test URLs.",
	);
}

// These URLs must address empty, disposable test databases. This test never drops a database.
const targets = [
	{ name: "SQLite", dialect: "sqlite", driver: SqliteDriver, url: "local" },
	{
		name: "local libSQL",
		dialect: "sqlite",
		driver: LibSqlDriver,
		url: "local",
	},
	...externalTargets,
];

for (const target of targets) {
	describe.skipIf(!target.url)(target.name, () => {
		it("applies app migrations and preserves auth, domain types, rollback, and capacity under concurrency", async () => {
			const directory = await mkdtemp(join(tmpdir(), "hackkit-dialect-"));
			const database: HackKitDatabaseOptions = {
				driver: target.driver,
				...(target.url === "local"
					? { dbName: join(directory, "test.db") }
					: target.driver === LibSqlDriver
						? { dbName: target.url! }
						: { clientUrl: target.url! }),
				migrations: {
					path: join(process.cwd(), "db/migrations", target.dialect),
					snapshotOnMigrate: false,
				},
			};
			const config = {
				...appConfig,
				database,
				auth: {
					baseURL: "http://localhost:3000",
					secret: "matrix-secret-with-at-least-32-characters",
					emailAndPassword: { enabled: true },
				},
				logger: { disabled: true },
			};
			try {
				await runDbMigrate(config);
				await runDbSeed(config);
				const core = await initializeHackkit(config);
				try {
					expect(await core.orm.schema.getUpdateSchemaSQL()).toBe("");
					const signup = async (name: string) => {
						const result = await core.auth.api.signUpEmail({
							body: {
								name,
								email: `${name.toLowerCase()}@example.com`,
								password: "a sufficiently long password",
							},
							returnHeaders: true,
						});
						const cookie = result.headers.get("set-cookie");
						const session = await core.auth.api.getSession({
							headers: new Headers({ cookie: cookie ?? "" }),
						});
						expect(session?.user.id).toBe(result.response.user.id);
						return result.response.user.id;
					};
					const ownerId = await signup("Owner");
					const ownerScope = core.createScope(ownerId);
					const owner = await ownerScope.em.findOneOrFail(
						coreModels.user,
						{ authId: ownerId },
					);
					owner.roleId = "core.owner";
					await ownerScope.em.flush();
					await ownerScope.hackkit.settings.set({
						actorAuthId: ownerId,
						key: CoreSetting.MaximumRegistrations,
						value: 1,
					});
					const ids = [];
					for (const name of ["One", "Two"]) {
						const authId = await signup(name);
						ids.push(authId);
						const scope = core.createScope(authId);
						await scope.hackkit.users.claimHackTag({
							authId,
							hackTag: name.toLowerCase(),
						});
						await scope.hackkit.userData.completeUserData({
							authId,
							age: 21,
							gender: "prefer_not_to_answer",
							race: "prefer_not_to_answer",
							ethnicity: "prefer_not_to_answer",
							shirtSize: "m",
							dietaryRestrictions: ["none"],
							hasAcceptedMLHCodeOfConduct: true,
							hasSharedDataWithMLH: true,
							isEmailable: false,
						});
					}
					const results = await Promise.allSettled(
						ids.map((authId) =>
							core
								.createScope(authId)
								.hackkit.hackers.registerHacker({
									authId,
									university: "UTSA",
									major: "Computer Science",
									levelOfStudy: "undergraduate",
									hackathonsAttended: 0,
									softwareExperience: "beginner",
								}),
						),
					);
					expect(
						results.filter(
							(result) => result.status === "fulfilled",
						),
					).toHaveLength(1);
					expect(
						results.find((result) => result.status === "rejected"),
					).toMatchObject({ reason: { code: "INVALID_OPERATION" } });
					const hacker = await core
						.createScope()
						.em.findOneOrFail(coreModels.hacker, {
							authId: { $in: ids },
						});
					const participant = core.createScope(hacker.authId);
					const profile = await participant.hackkit.users.getUser(
						hacker.authId,
					);
					expect(profile).toMatchObject({
						roleId: "core.participant",
						isApproved: true,
						checkedInAt: null,
					});
					expect(profile?.createdAt).toBeInstanceOf(Date);
					expect(Object.getPrototypeOf(profile)).toBe(
						Object.prototype,
					);
					const data = await participant.hackkit.userData.getUserData(
						hacker.authId,
					);
					expect(data).toMatchObject({
						dietaryRestrictions: ["none"],
						isEmailable: false,
						phoneNumber: null,
					});
					await expect(
						core.createScope().em.transactional(async (em) => {
							const record = await em.findOneOrFail(
								coreModels.user,
								{ authId: hacker.authId },
							);
							record.bio = "must roll back";
							await em.flush();
							throw new Error("abort matrix transaction");
						}),
					).rejects.toThrow("abort matrix transaction");
					expect(
						(
							await core
								.createScope()
								.hackkit.users.getUser(hacker.authId)
						)?.bio,
					).toBeNull();
					const team =
						await participant.hackkit.plugins.teams.createTeam({
							actorAuthId: hacker.authId,
							name: "Typed team",
							tag: "typed",
						});
					expect(team.members[0]?.user.authId).toBe(hacker.authId);
					expect(Object.getPrototypeOf(team)).toBe(Object.prototype);
					await expect(
						core.createScope().hackkit.users.claimHackTag({
							authId: ownerId,
							hackTag: profile!.hackTag!,
						}),
					).rejects.toMatchObject({ code: "CONFLICT" });
					const cleanup = core.createScope().em;
					await cleanup.nativeDelete(AuthUser, {
						id: ids.find((id) => id !== hacker.authId)!,
					});
					expect(
						await core
							.createScope()
							.em.count(coreModels.userData, {}),
					).toBe(1);
				} finally {
					await core.orm.close();
				}
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}, 30000);
	});
}
