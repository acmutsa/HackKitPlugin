/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		// SQL drivers load native modules and must execute through Node.
		serverComponentsExternalPackages: [
			"@hackkit/core",
			"@mikro-orm/core",
			"@mikro-orm/sql",
			"@mikro-orm/sqlite",
			"@mikro-orm/libsql",
			"@mikro-orm/mysql",
			"@mikro-orm/postgresql",
			"@mikro-orm/migrations",
			"@a77ay/better-auth-mikro-orm",
		],
	},
	transpilePackages: [
		"@hackkit/ui",
		"@hackkit/next",
		"@hackkit/plugin-teams",
		"@hackkit/plugin-discord",
	],
};

export default nextConfig;
