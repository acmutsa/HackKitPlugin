# Next.js integration

HackKit uses package-owned better-call endpoints and its typed path client. `@hackkit/next` supplies Next request setup and page guards. See [its README](../../packages/next/README.md) for the interface and [the reference app](../../templates/nextjs-full/README.md) for database commands.

| Concern                                 | Owner               | App integration                                            |
| --------------------------------------- | ------------------- | ---------------------------------------------------------- |
| Connections, entities, Better Auth      | Core                | Supply database, auth, plugins, and app entities in config |
| Server render session and scope         | Next runtime        | Register `host.getRuntime` as a factory                    |
| Auth HTTP and cookies                   | Better Auth / Next  | Forward GET/POST to the Core auth handler                  |
| Browser endpoints and request isolation | Core and plugins    | Forward POST from one catch-all route to `host.handler`    |
| Typed browser calls                     | better-call client  | Pass a client to the UI provider                           |
| Plugin page routes                      | CLI sync            | Install package-owned page reexports                       |
| Page access rules                       | Next guards         | Resolve guards inside server layouts                       |
| Migrations and seed data                | App release process | Run explicit database commands                             |

## Request lifecycle

Each browser call checks its origin and body format, resolves its Better Auth session, and executes the endpoint in a fresh native MikroORM RequestContext. The authenticated runner supplies the actor. Strict endpoint body schemas reject actor overrides. Domain methods enforce permissions and return plain DTOs.

The endpoint factory serializes its result before returning it. Its inferred return type therefore matches JSON: dates become strings and void becomes null. HTTP success bodies contain the result directly. Better-call returns it as `{ data, error: null }`. Server failures retain safe messages and stable codes. Better-call adds HTTP status and status text to its error result.

Session response cookies propagate through the handler, including expired-session cookie removal. Missing and expired sessions return 401. Components retain their draft and offer sign-in in another tab. Success navigation and refresh remain caller-owned. Mutations are not automatically retried.

Server pages keep calling Core through `getRuntime()`. Jobs use `core.run(callback, actorAuthId)` or an explicit scope. These paths need no browser wrappers.

## Browser calls and plugins

The app imports `createHackkitClient` from `@hackkit/core/http/client`, creates its client at module scope in `app/providers.tsx`, and passes it to `HackKitUIProvider`. A call uses a typed path and options, for example `client("@post/users/claim-hack-tag", { body: values })`. Schemas and domain constants remain available from `@hackkit/core/client`.

Each endpoint plugin defines a server endpoint factory and exposes it as `endpoints`. Its `/client` entry exports only the inferred endpoint type, such as `TeamsEndpoints`. Plugin components call `useHackkitClient<TeamsEndpoints>()` to bind a native better-call client using the provider's HTTP settings. These are small memoized call functions. They make no discovery requests and import no endpoint implementations into the browser. An application that calls plugin paths directly can use `createHackkitClient<TeamsEndpoints>()`, or intersect multiple plugin endpoint types.

`hackkit plugin sync` installs page reexports and updates the lockfile. It generates no browser client, route metadata, or action wrappers. Package builds and watch mode use ordinary `tsup` without a metadata-generation step.

Plugins with `enabled: false` retain their database entities, settings, and permissions. The handler skips their endpoint factories, and their pages use the enabled-plugin guard. Client types describe expected endpoints; server configuration determines which routes exist.

The pinned better-call client checks paths and field value types. Required bodies and unknown body keys are enforced by the server schemas. Network and parsing exceptions use better-fetch's `catchAllError` result with `statusText: "Fetch Error"`; the UI shows a retry message. There is no custom network-error taxonomy or response-envelope decoder.

The initial interface contains 25 Core, five Teams, and two Discord operations. Server-rendered reads remain direct Core calls. The current handler supports POST operations; GET/query inputs and dynamic path parameters are outside the exercised contract.

Core endpoint definitions are grouped by domain in `packages/core/src/http/endpoints/`. Its `index.ts` composes the groups into one endpoint map. All groups use the shared authenticated runner, and scan operations share the QR schema and target resolution in the Event Pass group.

## Verification

Use the repository-pinned pnpm through `corepack pnpm`. Run package builds, typechecks, and tests, then the web production build and `corepack pnpm test:e2e:http`. HTTP checks use a fresh disposable SQLite database. `node tooling/check-client-bundle.mjs` bundles the provider entry and checks its inputs for recognized server implementations.
