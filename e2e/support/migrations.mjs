import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { e2eDirectory } from "./templates.mjs";

/** Give generated TypeScript migrations an isolated history and resolvable imports.
 * @param {string} directory
 */
export async function prepareMigrationDirectory(directory) {
	const path = join(directory, "migrations");
	await mkdir(directory, { recursive: true });
	await symlink(
		join(e2eDirectory, "node_modules"),
		join(directory, "node_modules"),
		"dir",
	);
	return path;
}
