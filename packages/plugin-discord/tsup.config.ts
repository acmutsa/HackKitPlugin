import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/actions.ts"],
	format: ["cjs", "esm"],
	dts: true,
});
