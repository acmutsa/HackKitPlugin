import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(resolve("e2e/package.json"));
const { build } = require("esbuild");
for (const template of [
	"templates/nextjs-full",
	"templates/nextjs-minimal",
	"apps/demo",
]) {
	const result = await build({
		entryPoints: [`${template}/app/providers.tsx`],
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
			template,
			browserBundleBytes: result.outputFiles[0].contents.length,
			modules: files.length,
			serverModules: forbidden.length,
		}),
	);
}
