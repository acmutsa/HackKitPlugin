# HackKit end-to-end validation

Tests run the actual [full](../templates/nextjs-full/README.md) and [minimal](../templates/nextjs-minimal/README.md) templates. There is no separate test application. Package tests remain beside the libraries.

## Commands

From the repository root, use Node.js 22.17+ and pinned pnpm 12.15.0:

1. Run `corepack pnpm install`.
2. Install Chromium with `corepack pnpm --filter @hackkit/e2e exec playwright install chromium`. On Linux CI, add `--with-deps`.
3. Run `corepack pnpm test:e2e`.

Choose `test:e2e:db`, `test:e2e:http`, or `test:e2e:browser` to run a focused suite. The runner builds library dependencies, checks plugin sync for changes, typechecks templates and E2E, and checks both browser bundles. HTTP/browser suites also migrate and seed temporary build databases and build both production apps once. Runtime databases are separate from build databases.

Stop template development servers before testing, and run one E2E invocation at a time. The fixtures use loopback ports 33017 for full and 33018 for minimal, refuse occupied ports, and never reuse an existing server. Each worker gets a new temporary database and upload directory. Application commands run from the selected template's directory using explicit test configuration. No developer database or uploads are selected. One Chromium worker runs without retries; browser sessions and accounts are independent. Each test supplies a distinct simulated proxy client IP so production authentication rate limits remain enabled without sharing one test-client bucket.

## Coverage

-   `database`: committed migrations, auth/domain integration, schema upgrades, drift, rollback/reapply, plugin retention, concurrency, and real application command isolation.
-   `http`: production cookies/sessions, access control, Core and plugin mutations, actor rejection, and JSON serialization. Playwright API tests do not launch a browser.
-   `browser`: signup and complete onboarding, persisted registration, signout/signin, participant/admin guards, approval state, owner access, and full-template team invitations across sessions.

E2E-only database helpers promote known test user IDs and configure approval. Applications expose no testing or bootstrap endpoints. Tests that change approval settings restore them in teardown. External OAuth, hosted Turso authentication/TLS, email delivery, Discord role synchronization, and S3 operations require separate deployment validation.

## Database matrix

SQLite and local libSQL run locally. Supply URLs for empty, disposable external databases to add:

-   `HACKKIT_TEST_POSTGRESQL_URL`
-   `HACKKIT_TEST_MYSQL_URL`
-   `HACKKIT_TEST_LIBSQL_URL`

Set `HACKKIT_REQUIRE_DATABASE_MATRIX=1` to fail if any URL is missing. CI requires all five targets. The full template runs the multi-driver migration/upgrade suite; the minimal template uses its own SQLite schema. HTTP libSQL migration commands retain one Node process per operation to avoid native-client lifecycle hangs.

## Diagnostics

Playwright writes HTML reports to `playwright-report` and JUnit results, worker server logs, traces, and failure screenshots to `test-results`. CI uploads these artifacts on failure. Startup failures include captured server output. Child processes have timeouts and bounded shutdown; temporary runtime storage is removed after teardown.
