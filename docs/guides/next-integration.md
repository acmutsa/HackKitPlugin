# Next.js integration

HackKit is a Better Auth plugin. A Next.js app instantiates Better Auth once and loads HackKit beside other Better Auth plugins:

```ts
export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite", schema }),
	plugins: [hackkit(appConfig), nextCookies()],
});
```

Server code calls named endpoints such as `auth.api.getHackkitMe`, `auth.api.listHackkitEvents`, or `auth.api.createHackkitTeam`. Identity is taken from Better Auth session middleware; callers do not supply an actor ID.

The browser client loads the inference-only companion plugin:

```ts
export const authClient = createAuthClient({
	plugins: [hackkitClient()],
});
```

Run `auth generate` to produce one Drizzle schema containing Better Auth and HackKit models. The app remains responsible for generating and applying migrations.
