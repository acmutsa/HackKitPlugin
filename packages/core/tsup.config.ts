import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/client.ts", "src/testing.ts"],
	format: ["cjs", "esm"],
	dts: true,
	external: ["vitest"],
});
