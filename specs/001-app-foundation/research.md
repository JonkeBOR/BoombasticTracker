# Research: App Foundation with Fitness Tracker Entry

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Date**: 2026-10-01

Each entry records a decision, why it was made, and what was rejected. Versions are those in
`package.json` on 2026-10-01 (Next 16.3.4, React 19.3, TypeScript 6).

## R1. Deploying Next 16 to Cloudflare Workers

**Decision**: Build with `@opennextjs/cloudflare` and deploy with Wrangler. Configuration lives in
`wrangler.jsonc` (the format the adapter's docs use), with `main: ".open-next/worker.js"`,
`compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`, an `ASSETS` binding on
`.open-next/assets`, the `WORKER_SELF_REFERENCE` service binding, and `account_id`
`2c9deedd46d8135271fef57c6854e55c`. `next.config.ts` calls `initOpenNextCloudflareForDev()` so
`next dev` gets local emulations of the bindings. No `open-next.config.ts` incremental cache is
configured: every page is dynamic (it reads the session cookie), so there is nothing to cache.

**Rationale**: The adapter supports every Next 16 minor. One Worker serves pages, assets and
route handlers, which is what the constitution's Principle IV requires.

**Alternatives considered**: An R2 incremental cache, rejected because it has no consumer.
`@cloudflare/next-on-pages`, rejected because it is the deprecated predecessor and needs the Edge
runtime everywhere.

**Risk to verify at first deploy**: the Workers free plan caps a Worker at 3 MiB compressed. A
small Next 16 app is expected to fit. `opennextjs-cloudflare build` reports the size, and the
quickstart checks it.

## R2. Where authentication checks run — no Proxy

**Decision**: Do not use `proxy.ts`, and do not use the deprecated `middleware.ts`. Every
protected page calls `requireSession()`, a server-only function memoised with React `cache`. It
verifies the session cookie and calls `redirect()` to the sign-in screen when the session is
missing or invalid. Every route handler that ever touches personal data does the same check
before any work. This feature has no such handler.

**Rationale**: Next 16's Proxy always runs on the Node.js runtime, and OpenNext's Cloudflare
adapter does not support Node middleware. Next's own authentication guide says Proxy is only an
optional optimistic check, and that the real check belongs close to the data. It also warns
against checking auth in layouts, because layouts do not re-render on client navigation. A check
per page is therefore both the supported design and the recommended one.

**Alternatives considered**: Proxy (unsupported on the target). Edge `middleware.ts`
(deprecated in Next 16, and it would be a second place holding auth logic). A check in a layout
(not re-run on navigation).

## R3. Google OAuth library

**Decision**: `arctic` for the Google authorization-code flow with PKCE and `state`. The flow
requests only the `openid`, `email` and `profile` scopes. Arctic's `decodeIdToken` reads the ID
token returned by the token endpoint.

**Rationale**: Arctic is built on `fetch` and Web Crypto with no Node-specific APIs, so it runs
on Workers as-is. It is small and does exactly the flow needed, with no session or database
opinions. The ID token comes straight from Google's token endpoint over TLS in exchange for the
client secret, so OpenID Connect Core §3.1.3.7 allows trusting it without verifying its
signature.

**Alternatives considered**:

- Auth.js / NextAuth: a large surface with adapters and callbacks, and its Next 16 + Workers
  support is less certain.
- better-auth: wants a database for sessions, and this feature creates no tables.
- A hand-rolled flow: PKCE and state handling are easy to get subtly wrong, and Arctic is the
  small, audited version of the same thing.

## R4. Application session

**Decision**: A stateless session held entirely in one cookie: a JWT signed with HS256 using
`jose`, carrying `sub` (the Google subject), `email`, `iat` and `exp`. The lifetime is fixed at
**90 days** from sign-in, with no sliding renewal in this feature. The cookie is named `session`
and set `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 90 days, and `Secure` whenever the
request arrived over HTTPS (see R5). No Google access token or refresh token is kept anywhere:
the app needs Google only to learn who signed in, so it discards both after the callback.

**Rationale**:

- The spec's baseline migration creates no tables, so the session cannot live in the database.
- The cookie holds no secret, only identity the owner already knows, so it needs signing, not
  encryption.
- `jose` is the standard Web Crypto JWT library and runs on Workers.
- Not keeping Google tokens at all is the strongest way to satisfy FR-008.
- Sliding renewal would require writing a cookie on ordinary page loads. Next forbids setting
  cookies during Server Component rendering, and Proxy is unavailable (R2). A fixed 90 days
  exceeds the spec's 30-day minimum (FR-006, SC-001) with no renewal machinery.

**Alternatives considered**: An encrypted JWE, not needed since the cookie holds nothing
confidential. A database-backed session, ruled out by the empty baseline. Hand-rolled HMAC with
Web Crypto, rejected because signature comparison and parsing are where homemade code fails.
Sliding renewal through a client-side ping to a route handler, deferred until the fixed lifetime
proves annoying in practice.

## R5. The `Secure` attribute in local development

**Decision**: Set `Secure` from the request's protocol. Deployed requests are always HTTPS on
`*.workers.dev`, so the deployed cookie is always `Secure`. Over `http://localhost:3000` (local
dev and the Playwright run) it is omitted.

**Rationale**: The Google client's registered local return address is
`http://localhost:3000/api/auth/google/callback`. The end-to-end project runs mobile WebKit, which
does not reliably store `Secure` cookies over plain-HTTP localhost. The constitution's `Secure`
requirement protects cookies in transit over networks, and loopback HTTP never leaves the
machine. This exception is recorded in the plan's Complexity Tracking.

**Alternatives considered**: Running dev over HTTPS with `next dev --experimental-https` would
require registering an `https://localhost` return address and re-trusting certificates in
WebKit; it can be adopted later without code changes.

## R6. Who counts as the owner

**Decision**: The owner is configured as `OWNER_EMAIL`. After the code exchange, access is granted
only when the ID token's `email_verified` is `true` and its `email` equals `OWNER_EMAIL`, compared
case-insensitively. Any other account is redirected to the sign-in screen with
`?error=not-allowed`, and no session cookie is set.

**Rationale**: FR-002 requires the app itself to refuse other accounts. The Google consent
screen's test-user list is a second barrier, not the only one.

**Alternatives considered**: Matching Google's `sub`, which is stronger in principle but is not
known until the first sign-in. It could replace the email check later.

## R7. Redirect URI and return path

**Decision**: The OAuth redirect URI is derived from the incoming request's origin plus
`/api/auth/google/callback`, so no `APP_URL` setting is needed. The page the owner was heading to
travels as `returnTo`, which is accepted only if it is a same-origin path: it starts with a single
`/`, not `//` and not `/\`. It is held in a short-lived cookie across the Google round trip.

**Rationale**: One less configuration value. Google enforces an exact match against registered
URIs anyway, so an unexpected origin fails safely at Google. Restricting `returnTo` to local paths
prevents open redirects.

## R8. Database and the baseline migration

**Decision**: One D1 database bound to the Worker as `DB` and declared in `wrangler.jsonc` with
`migrations_dir: "migrations"`. The baseline is `migrations/0001_baseline.sql`, created with
`wrangler d1 migrations create` and applied with `wrangler d1 migrations apply` — `--local` for
development, which writes a SQLite file under the gitignored `.wrangler/state/`, and `--remote`
for D1. The file contains a single no-op statement, because Wrangler refuses to apply a
migration with no statements. Wrangler records it in its own `d1_migrations` tracking table, and
no application table is created.

`next dev` reaches the same local SQLite file through `initOpenNextCloudflareForDev()`, so local
development and the deployed Worker use one driver (the D1 binding) rather than D1 in the cloud
and a separate SQLite driver locally.

**Rationale**: Wrangler is already required to deploy, and it applies migrations to both
environments. Nothing in this feature reads the database, so no runtime database dependency is
added.

**Deviation — Drizzle deferred**: The constitution's Technology Stack names Drizzle ORM as the
single source of schema and migrations. Adopting it now is not possible without inventing work:
`drizzle-kit generate` requires a `schema` file, and the spec forbids defining any schema. Current
`drizzle-kit` also writes each migration into its own timestamped folder, while
`wrangler d1 migrations` expects flat `.sql` files in `migrations_dir`. Introducing Drizzle with
the first table is the point where that layout question has a real answer. The baseline is a
plain Wrangler migration, the first Drizzle-generated migration will sort after it, and
`d1_migrations` tracks applied files by name, so nothing is lost. Recorded in Complexity Tracking.

**Alternatives considered**: An empty Drizzle schema module to satisfy `drizzle-kit`, rejected as
a file with no occupant. A separate local SQLite driver (`better-sqlite3`), rejected because it
needs a native build on Windows and gives two drivers where one suffices.

## R9. Configuration and secrets

**Decision**: Four values, read only in a server-only `config` module:

| Name                   | Secret                          | Local source | Deployed source         |
| ---------------------- | ------------------------------- | ------------ | ----------------------- |
| `GOOGLE_CLIENT_ID`     | no                              | `.env.local` | `wrangler.jsonc` `vars` |
| `GOOGLE_CLIENT_SECRET` | yes                             | `.env.local` | `wrangler secret put`   |
| `SESSION_SECRET`       | yes (≥ 32 random bytes, base64) | `.env.local` | `wrangler secret put`   |
| `OWNER_EMAIL`          | no                              | `.env.local` | `wrangler.jsonc` `vars` |

`.dev.vars` mirrors `.env.local` for `opennextjs-cloudflare preview` and must be added to
`.gitignore`; `.env*.local` already is. The `client_secret_*.json` download is only the source the
developer copies the values from, and is gitignored. OpenNext exposes Worker vars and secrets on
`process.env`, so the module reads `process.env` in both environments and fails with a clear
message naming any missing variable.

**Rationale**: Matches FR-017–FR-018 and the source spec's split between local and cloud
configuration. A single module is the only place that knows where configuration comes from.

## R10. Testing a Google sign-in end to end

**Decision**: Playwright never drives Google's sign-in page. Signed-in acceptance tests mint a
valid session cookie with the same signing function the app uses, read `SESSION_SECRET` from
`.env.local` via `@next/env` (which ships with Next), and add it with `context.addCookies`.
Signed-out tests assert the sign-in screen, the `?error=` messages, and that "Sign in with Google"
links to `/api/auth/google`. Under the ADR 003 two-loop workflow, everything with logic is a
Vitest test:

- the session signer and verifier (expiry, tampering, wrong secret)
- `returnTo` validation
- the owner check
- error-code mapping
- the three route handlers, called directly with a `Request` and an injected OAuth client

**Rationale**: Automating Google's login is brittle, forbidden by Google's terms for bots, and
would need real credentials in the test run. The real Google round trip is checked by hand in the
quickstart: once locally and once deployed.

## R11. Feature routing

**Decision**: Features live under their own route segment (`src/app/fitness-tracker/`). The
landing page renders its cards from one typed registry in `src/lib/features.ts`, which holds each
entry's title, description and path. Adding a feature means adding its route folder and one
registry entry (FR-012). `src/features/` is not created: the placeholder page has no components or
logic of its own to put there.

**Rationale**: It is the smallest structure that satisfies FR-010–FR-012 and SC-006.

## R12. Sign-in from the Home Screen app

**Decision**: The sign-in button is a plain link to `/api/auth/google`, which redirects to Google.
iOS opens out-of-scope origins from a standalone web app in an in-app browser sheet and returns to
the app when the redirect comes back into scope.

**Risk to verify on device**: Home Screen apps have their own cookie store, separate from Safari,
so the callback must complete inside the standalone app for the session cookie to land there. The
quickstart includes a device check. If it fails, that is a defect against User Story 1 to fix
before the feature is done, not something to work around by signing in through Safari.
