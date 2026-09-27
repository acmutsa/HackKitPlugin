# Define HackKit Core as a framework-independent kernel with a generic typed database adapter

> Superseded: [ADR 0013](0013-mikroorm-and-core-auth.md) adopts native MikroORM entities and queries, Core-owned Better Auth, and explicit MikroORM migration commands. The historical decision below no longer governs persistence. Domain boundaries and app ownership of reviewed migrations remain.

HackKit Core is the framework-independent kernel for hackathon domain behavior, not the fully built web app or runtime framework. Starter applications import HackKit packages rather than copying core source, while Core exposes module-shaped APIs around Users, User Data, Hackers, Roles, Registration, and future modules. Core accepts a high-level generic `database` adapter whose operations use typed namespaced model descriptors; Core owns its canonical model shapes, and plugins may contribute additional namespaced models, namespaced permissions, and optional API methods through a Better Auth-style `plugins` array passed to `createHackkit`. Public Core APIs enforce authorization internally using actor Auth IDs, including `core.admin` for permission bypass while respecting role hierarchy and `core.super_admin` for full hierarchy bypass.

Core will be added alongside the existing apps and packages during the rewrite; existing packages and apps remain unchanged until an explicit migration step.
