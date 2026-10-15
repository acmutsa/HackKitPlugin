import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(resolve("packages/core/package.json"));
const vitestRequire = createRequire(require.resolve("vitest"));
const { build } = createRequire(vitestRequire.resolve("vite"))("esbuild");
const result = await build({
	entryPoints: ["apps/web/app/providers.tsx"],
	bundle: true,
	platform: "browser",
	format: "esm",
	minify: true,
	write: false,
	metafile: true,
	logLevel: "silent",
});
const files = Object.keys(result.metafile.inputs);
const forbidden = files.filter((file) =>
	/(?:@mikro-orm|better-auth|\/core\/(?:src|dist)\/(?:mikro|models|hackkit|plugins)|\/(?:endpoints|api|http-server|handler)\.js$)/.test(
		file,
	),
);
assert.deepEqual(
	forbidden,
	[],
	"Server implementations entered the browser client bundle.",
);
console.log(
	JSON.stringify({
		browserBundleBytes: result.outputFiles[0].contents.length,
		modules: files.length,
		serverModules: forbidden.length,
	}),
);
