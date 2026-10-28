import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	optimizeDeps: {
		// Zod 3 in HackKit and Zod 4 in Better Auth must resolve per importer.
		// MikroORM's optional filesystem imports cannot be prebundled for Workers.
		exclude: [
			"zod",
			"@mikro-orm/core",
			"@mikro-orm/sql",
			"@mikro-orm/migrations",
		],
	},
	plugins: [
		vinext(),
		cloudflare({
			viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
		}),
	],
	resolve: {
		dedupe: [
			"react",
			"react-dom",
			"react-server-dom-webpack",
			"@mikro-orm/core",
			"kysely",
		],
	},
});
