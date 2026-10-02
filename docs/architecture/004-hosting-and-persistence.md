# 004 — Hosting, sign-in and persistence

**Status**: accepted
**Date**: 2026-10-01

## Context

Constitution 2.0.0 replaced Google Sheets with a SQLite-family database and chose Cloudflare
Workers as the host. The first feature, `specs/001-app-foundation`, had to turn that into a running
app: sign-in, a session, protected pages and a database. The detailed reasoning is in that
feature's `research.md`; this record keeps the decisions that outlive the feature.

## Decision

### One Worker, built with OpenNext

The app deploys as a single Cloudflare Worker, built by `@opennextjs/cloudflare` and configured in
`wrangler.jsonc` with `nodejs_compat`. `next dev` calls `initOpenNextCloudflareForDev()` so local
development sees the same bindings. No incremental cache is configured, because every page reads the
session cookie and is dynamic.

The free plan limits the Worker to 3 MiB compressed. At the first build the Worker measured
1.08 MiB compressed (5.2 MiB uncompressed, `npx wrangler deploy --dry-run`). A dependency that
pushes past the limit needs a deliberate decision.

Two adapter quirks are worked around rather than discovered again:

- `@opennextjs/cloudflare` 1.20.7 refuses to build without `open-next.config.ts`, so the repository
  carries a minimal one with no overrides.
- The same release imports `esbuild` at build time but declares it only as a devDependency of its
  own, so this repository declares `esbuild@^0.27` itself. Remove it once the adapter declares the
  dependency properly.

OpenNext warns that it is not fully supported on Windows. The build, `wrangler dev` and the
`next dev` bindings all worked on Windows during this feature; WSL is the fallback if they stop
working.

### No Proxy: each page checks the session

Next 16's Proxy (formerly middleware) runs on the Node.js runtime, which OpenNext does not support,
and Next's own guidance treats Proxy only as an optional optimistic check. Every protected page
calls `requireSession(path)` from `src/lib/server/session-cookie.ts`, which redirects to
`/sign-in` without a valid session. Any future route handler that touches personal data checks the
session the same way before doing anything. Checks do not go in layouts, which do not re-render on
client navigation.

### Google for identity only, and a stateless session

Sign-in uses Arctic's Google client with PKCE and `state`, requesting only `openid`, `email` and
`profile`. The callback admits only a verified email equal to `OWNER_EMAIL`, then **discards
Google's tokens**: nothing the app does needs them, so none are stored anywhere.

The session is a JWT signed with HS256 (`jose`) in one `HttpOnly`, `SameSite=Lax` cookie, valid for
a fixed 90 days. Rotating `SESSION_SECRET` signs every session out. There is no sliding renewal:
Next forbids setting cookies during Server Component rendering and Proxy is unavailable, so renewal
would need a route the client calls. That is worth adding only if 90 days proves short in practice.

`Secure` is set whenever the request arrived over HTTPS, which every deployed request does. It is
omitted only on plain-HTTP `localhost`, where the registered Google redirect URI lives and where
Playwright's WebKit does not reliably keep `Secure` cookies.

### D1 with Wrangler migrations; Drizzle when there is a schema

The database is Cloudflare D1, bound as `DB`. Locally it is the SQLite file Wrangler keeps under
`.wrangler/state/`, reached by `next dev` through the same binding, so there is one driver in both
environments.

Migrations are plain SQL files in `migrations/`, applied with
`wrangler d1 migrations apply --local|--remote`. When this record was written the only migration
was a baseline holding `SELECT 1;`, because Wrangler refuses a migration with no statements.

Drizzle ORM, deferred here until the first table, arrived with `specs/002-fitness-domain-model`.
The baseline was removed, Drizzle's generated files now live in `migrations/`, and how they meet
Wrangler is recorded in [006-domain-persistence.md](006-domain-persistence.md).

### Configuration

| Value                  | Local                        | Deployed                |
| ---------------------- | ---------------------------- | ----------------------- |
| `GOOGLE_CLIENT_ID`     | `.env.local` and `.dev.vars` | `wrangler.jsonc` `vars` |
| `OWNER_EMAIL`          | `.env.local` and `.dev.vars` | `wrangler.jsonc` `vars` |
| `GOOGLE_CLIENT_SECRET` | `.env.local` and `.dev.vars` | `wrangler secret put`   |
| `SESSION_SECRET`       | `.env.local` and `.dev.vars` | `wrangler secret put`   |

Only `src/lib/server/config.ts` reads them. The OAuth redirect URI is derived from the request's
origin, so there is no `APP_URL`.

## Consequences

- `src/app/` pages that need a signed-in owner start with `await requireSession(path)`. Forgetting
  it leaves a page public, and the acceptance tests are what catch that.
- The end-to-end tests never drive Google's sign-in page. They mint a session cookie with the app's
  own signing function and `SESSION_SECRET` from `.env.local`; the real Google round trip is checked
  by hand.
- `npm` blocks dependency install scripts by default; `workerd` and `esbuild` are approved in
  `package.json` under `allowScripts`, and a version bump of either needs approving again.
