# Standalone templates and CLI initialization

Status: deferred. Current templates are runnable workspace examples. Packages remain private. This change does not publish packages or add an init command.

The next distribution milestone will add `hackkit init <directory> --template minimal|full`, defaulting to minimal. The command must create a complete project without overwriting an existing destination. It must not copy repository credentials, databases, uploads, build output, or test infrastructure.

Required work:

-   Establish public package metadata, dependency versions, release versioning, and npm scope access before publication.
-   Include distributable template assets with the CLI and substitute released package versions for workspace references.
-   Make application scripts and Tailwind content discovery work without monorepo source paths.
-   Keep each template's configuration, database commands, reviewed migrations, and setup documentation inside the generated project.
-   Validate packed packages and both generated projects outside the monorepo. Verify initialization, dependency installation, plugin synchronization, migrations, seeding, typechecking, and production builds without workspace symlinks.
-   Review the release artifacts before publishing. Define the first release version, registry ownership, authentication, and publishing workflow as part of that milestone.

Acceptance requires a working fresh project from the distributed CLI for each template. An in-workspace build alone does not establish standalone readiness.
