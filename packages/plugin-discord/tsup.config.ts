import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/client.ts"],
	format: ["cjs", "esm"],
	dts: true,
});
