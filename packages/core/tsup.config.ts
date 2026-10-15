import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		client: "src/client.ts",
		testing: "src/testing.ts",
		"http/index": "src/http/index.ts",
		"http/client": "src/http/client.ts",
		"http/event-pass": "src/http/event-pass.ts",
	},
	format: ["cjs", "esm"],
	dts: true,
	external: ["vitest"],
});
