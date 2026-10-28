import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
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
