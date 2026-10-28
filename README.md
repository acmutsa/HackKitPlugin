<p align="center" style="margin-bottom: 0px !important;">
  <img width="200" src="https://github.com/acmutsa/HackKit/assets/38444224/07cf3752-36e5-4c72-b74b-cbb48da1cfd3" alt="Material Bread logo" align="center">
</p>
<h1 align="center" style="margin-top: 0px;font-weight:800">HackKit</h1>
<h3 align="center"><b>Feature-packed Hackathon Managment Software That Just Works.</b><br></h3><br/>
<p>Putting together a hackathon is not an easy feat, like really not easy. While we can't help you with delayed packages, food orders being botched, or any of the other issues that can arise at the worst times, we can help you with the tech to make your hackathon go smoothly. <i>HackKit</i> is battle-tested and feature-packed to help your hackathon be the best it can be. From a seamless registration, to an easy-to-use admin panel, to event passes and more, <i>HackKit</i> has you covered. </p>
<p>Want to get started with using <i>HackKit</i>? Check out our <a href="https://hackkit-docs.acm-utsa.workers.dev">documentation</a> that will be updated as we add new features and fix bugs! </p>
<p>
 Have any questions, feedback, or need help hosting? Join our <a href="https://discord.acmutsa.org">Discord</a> or <a href="mailto:projectsofficer@acmutsa.org"> Contact our projects officer.</a></p></p>

## Technologies Used

- TypeScript
- Next.js
- MikroORM
- Better Auth
- Tailwind CSS

## Demo and documentation

- [Interactive demo](https://hackkit-demo.acm-utsa.workers.dev): explore a shared fictional event as a participant or organizer. [Deployment and local setup](apps/demo/README.md).
- [Documentation](https://hackkit-docs.acm-utsa.workers.dev): setup, templates, architecture, plugins, operations, and testing. [Contributing to the docs](apps/docs/README.md).

Configure the demo’s Turso credentials in `apps/demo/.dev.vars` and run its explicit database setup first; see [demo setup](apps/demo/README.md). `corepack pnpm dev:demo` then starts the demo on port 3001. `corepack pnpm dev:docs` starts Fumadocs on port 3002. The deployed apps live under `apps`; runnable workspace examples remain under `templates`.

## Development

Use Node.js 22.17+ and the repository-pinned pnpm 12.15.0 through Corepack. Run `corepack pnpm install` from this directory.

- [Full Next.js template](templates/nextjs-full/README.md): the existing app with Teams, Discord, email notifications, and configurable storage.
- [Minimal Next.js template](templates/nextjs-minimal/README.md): Core registration, participant profiles, and basic administration with local SQLite and uploads.
- [E2E validation](e2e/README.md): database, production HTTP, and browser integration checks against these templates.

`corepack pnpm dev` and `corepack pnpm dev:full` start the full template. `corepack pnpm dev:minimal` starts the minimal template. Root `db:*` commands target the full template. Select the minimal package explicitly for its database commands. For a new project, configure the database and plugins, generate an initial migration with `db:generate --name initial`, review and apply it, then seed roles. Commit the generated migration and snapshot to your application repository. Templates ship without baseline migrations; later clones of an initialized application apply its committed history. Each template's README covers setup, owner bootstrap, and production configuration.

`corepack pnpm build` builds libraries, templates, demo, and docs; configure each template for production first. `corepack pnpm test` runs package tests. `corepack pnpm test:e2e` prepares isolated configurations and runs all integration suites. Run one E2E invocation at a time because tests use fixed ports and each template's production output.

Both templates remain workspace examples. [CLI init and standalone releases](docs/plans/template-distribution.md) are a separate milestone. See the [persistence decision](docs/adr/0013-mikroorm-and-core-auth.md) for database ownership.

## Join The Team

Want to help us build HackKit? Please reach out to us at `tech@acmutsa.org` or join us on [Discord](https://go.acmutsa.org/projectsdiscord)!

## HackKit Contributors

<a href="https://github.com/acmutsa/HackKit/graphs/contributors">
<img src="https://contrib.rocks/image?repo=acmutsa/HackKit" />
</a>
