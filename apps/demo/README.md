# HackKit demo

A public demonstration of HackKit Core, the Next integration, package UI, and Teams. Vinext runs the application on Cloudflare Workers. Turso stores application data over HTTP. A private R2 binding stores uploads. The app owns its pages and configuration and does not import either template or E2E support.

## Credentials and local setup

Copy `.dev.vars.example` to **`apps/demo/.dev.vars`**. Fill in `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a random `BETTER_AUTH_SECRET` of at least 32 characters. Keep `BETTER_AUTH_URL=http://localhost:3001` for local development. This ignored file is the only local credential file used by the demo. Never point it at a real event database.

From the repository root:

```sh
corepack pnpm install
corepack pnpm exec turbo run build --filter=@hackkit/demo^...
corepack pnpm --filter @hackkit/demo plugin:sync
corepack pnpm --filter @hackkit/demo db:migrate
corepack pnpm --filter @hackkit/demo db:demo
corepack pnpm dev:demo
```

Open [localhost:3001](http://localhost:3001). Local development and preview run in Workerd. They use the configured Turso database and an emulated local R2 bucket. Local uploads persist under `.wrangler`. Database setup is an explicit Node command; requests never migrate or seed the database.

`db:demo` seeds fictional accounts, a team, and four schedule entries only when there are no existing users. Existing users are retained. Owner assignment is an explicit demo bootstrap operation. Neither template assigns owners automatically. `db:reset` is disabled for the shared demo database. Other database commands follow the template interface.

`corepack pnpm build:demo` compiles MikroORM entity functions ahead of time and builds the Worker. It needs no database connection or credentials. `corepack pnpm --filter @hackkit/demo start` previews that production build on port 3001.

## Cloudflare deployment

The committed configuration targets **ACM UTSA**, account `cdc7630e53b468f56a4453af71a58ade`, Worker `hackkit-demo`, and private R2 bucket `hackkit-demo-uploads`. Verify Wrangler's account with `corepack pnpm --filter @hackkit/demo exec wrangler whoami`.

Set `vars.BETTER_AUTH_URL` in `wrangler.jsonc` to the exact public origin. Default: [hackkit-demo.acm-utsa.workers.dev](https://hackkit-demo.acm-utsa.workers.dev). Set these Worker secrets through Wrangler's interactive `secret put` command or the Cloudflare dashboard:

-   `TURSO_DATABASE_URL`
-   `TURSO_AUTH_TOKEN`
-   `BETTER_AUTH_SECRET`

For example, `corepack pnpm --filter @hackkit/demo exec wrangler secret put TURSO_AUTH_TOKEN` prompts for the token without putting it in command history. Do not upload the local `BETTER_AUTH_URL` as a secret; the deployed origin belongs in Wrangler configuration. R2 uses the `DEMO_UPLOADS` binding and requires no access keys or public bucket URL.

Run `corepack pnpm deploy:demo` after building workspace libraries. Run `corepack pnpm --filter @hackkit/demo deploy:check` after a build to inspect the deployment without publishing.

The hosted demo shares persistent Turso data and R2 uploads between visitors. Participant and organizer accounts are public. **Try registration** creates a new fictional account. Use fictional data only. Email delivery, OAuth, and Discord synchronization are disabled. This public demonstration is unsuitable for real participant records.

## Verification

Run `DEMO_TEST_URL=http://localhost:3001 corepack pnpm --filter @hackkit/demo test:smoke` against a running production preview. The checks cover role navigation, onboarding, permissions, and authenticated R2 uploads. CI uses a disposable local libSQL service and emulated R2; it never receives deployed database credentials.
