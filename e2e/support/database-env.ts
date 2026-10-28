// Config imports are intentionally inert: each database test supplies an explicit
// disposable connection before initializing an ORM or invoking an app command.
import { testEnvironment, templates } from "./templates.mjs";
import { join } from "node:path";
import { tmpdir } from "node:os";
Object.assign(
	process.env,
	testEnvironment(templates.full, join(tmpdir(), "hackkit-unused-config")),
	{ NODE_ENV: "test" },
);
