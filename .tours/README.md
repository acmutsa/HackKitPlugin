# HackKit repository walkthrough

Open the repository root in VS Code with the CodeTour extension enabled. In the Explorer's CodeTour view, start **01. Repository map and composition**. It is the primary tour. Each chapter names the next tour, and linked tour titles let you jump between topics.

These tours describe the `templates-and-testing` working tree, including its uncommitted template/E2E split. They do not pin a Git ref. Paths and regex anchors refer to the current files. Read them with the repository root as the workspace folder.

The walkthrough has 8 chapters and 117 steps. Each step explains the role of the selected code, its inputs and outputs, important checks, and the next boundary where relevant. No step runs a command or edits source automatically.

-   [01. Repository map and composition](01-repository-map.tour) (11 steps)
-   [02. Core startup and persistence](02-core-startup.tour) (13 steps)
-   [03. Core domain behavior](03-core-domain.tour) (19 steps)
-   [04. Plugin contracts and Teams](04-plugin-system.tour) (16 steps)
-   [05. CLI and plugin page installation](05-cli-route-sync.tour) (9 steps)
-   [06. HTTP, Next integration, and browser UI](06-request-flow.tour) (18 steps)
-   [07. Notifications, Discord, storage, and deployed apps](07-integrations-apps.tour) (17 steps)
-   [08. Verification and change guide](08-verification.tour) (14 steps)

The Core chapters explain shared initialization, per-execution EntityManagers, canonical auth users, registration, role hierarchy, settings, RSVP, check-in, groups, and transaction locking. The plugin chapter follows Teams through declarations, inferred API types, scoped setup, persistence, endpoints, forms, and server pages. Later chapters explain CLI route sync, request handling, notifications, Discord, storage, the demo Worker, docs, and the test suites.

For a focused first pass on the plugin system, read chapters 01, 02, 04, 05, and 06. For participant behavior, read chapters 02, 03, 06, and 08.

## Validation boundaries

The CodeTour anchor checker verifies all local files and unique regex matches. Additional checks verify tour sequencing, tour-title links, local Markdown links, and the installed extension's JSON schema. Source review checks descriptions against implementation. Editor playback has not been exercised, so discovery, comment placement, and rendered links still need a VS Code playback check.

Application tests are described as evidence to inspect. They were not run for this documentation-only change. Creating the tours does not verify current service credentials, deployment state, or hosted behavior. The tours do not install an extension or change workspace trust.
