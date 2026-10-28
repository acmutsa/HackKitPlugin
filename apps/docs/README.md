# HackKit documentation

Fumadocs MDX with local search, a documentation sidebar, dark mode, and static export. Source pages live in `content/docs`. Generated MDX output and `out` are ignored.

From the repository root:

- `corepack pnpm dev:docs`: develop at http://localhost:3002.
- `corepack pnpm build:docs`: export the complete site to `apps/docs/out`.
- `corepack pnpm --filter @hackkit/docs typecheck`: generate route types and check TypeScript.
- `corepack pnpm deploy:docs`: build and publish static assets to ACM UTSA's `hackkit-docs` Worker.

No environment variables, database, or runtime secrets are required. Wrangler pins the ACM UTSA account. Verify the signed-in identity before deployment. The Worker is independent of ACM's existing `docs` Worker.

Public URL: https://hackkit-docs.acm-utsa.workers.dev. The site's demo link targets the separate `hackkit-demo` deployment.

The docs use Next.js static export rather than a Workers SSR adapter. Fumadocs' generated search index and Markdown endpoints are exported as files. No Next.js server runs in production. This app has its own current Fumadocs/Next/React/Tailwind dependencies; the template versions remain unchanged.
