# HackKit runs as a Better Auth plugin

HackKit Web Apps load the complete HackKit Core runtime through the `hackkit(...)` Better Auth server plugin, with a matching client plugin for inferred endpoints. Better Auth owns authentication, sessions, and request lifecycle; the plugin installs HackKit into `auth.$context.hackkit`, derives HackKit Users from Better Auth identities, and exposes the complete nested HackKit API through authenticated and public Better Auth endpoints. This replaces the former standalone runtime plus Auth Adapter composition path.

## Consequences

-   There is one runtime composition root: `betterAuth({ plugins: [hackkit(config)] })`.
-   `@hackkit/next` calls HackKit operations through Better Auth endpoints; session-derived Auth IDs replace caller-provided identity fields at the boundary.
-   Public calls are allowlisted and cannot supply an Auth ID. Notification providers, unknown nested plugins, and other privileged plugin operations require the Admin permission.
-   The raw Core constructor is restricted to `@hackkit/core/internal` for the Better Auth plugin, CLI, and Core tests. Application code does not construct a parallel HackKit runtime.
-   HackKit still owns its richer adapter-neutral Storage Schema because Better Auth plugin schema cannot represent all existing primary-key and composite-constraint invariants. The plugin deliberately does not register HackKit tables in Better Auth's migration schema; the host app continues to generate adapter-native schema and owns migration generation and application.
-   HackKit Plugins remain domain extensions nested inside the HackKit Better Auth Plugin; they are not separate Better Auth plugins.
