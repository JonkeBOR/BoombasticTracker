# Implementation Plan: App Foundation with Fitness Tracker Entry

**Branch**: `001-app-foundation` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-app-foundation/spec.md`

## Summary

The existing Next 16 landing page becomes a signed-in, multi-feature app on Cloudflare Workers:

- **Sign-in**: one app-wide Google sign-in, using Arctic with PKCE and identity scopes only.
- **Session**: a stateless 90-day session in a signed `HttpOnly` cookie created with `jose`. No
  Google token is kept anywhere.
- **Protection**: every page checks the session itself, because OpenNext cannot run Proxy.
- **Landing page**: lists features from a one-entry registry. The fitness tracker is a placeholder
  route.
- **Database**: one D1 database with a single no-op baseline migration applied by Wrangler.
- **Deployment**: built with OpenNext.
- **README**: covers the Google, local and Cloudflare setup.

Research: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict), React 19.3, Next.js 16.3 App Router, Node.js ≥ 22.12
for tooling.

**Primary Dependencies**:

- Already present: `next`, `react`.
- Runtime additions: `arctic` (Google OAuth + PKCE) and `jose` (session JWT).
- Dev additions: `@opennextjs/cloudflare` and `wrangler`.

**Storage**: Cloudflare D1 (binding `DB`). Locally it is a Wrangler-managed SQLite file under
`.wrangler/state`. The only content is the baseline migration, and no code reads it.

**Testing**: Vitest + Testing Library for the inner loop, and Playwright (mobile WebKit, `iPhone
17`) for acceptance tests with a minted session cookie (research R10).

**Target Platform**: Cloudflare Workers (`nodejs_compat`), served to iPhone Safari in standalone
Home Screen mode.

**Project Type**: Single Next.js web application acting as UI and BFF in one deployable.

**Performance Goals**: The landing page appears in under 2 s from a Home Screen launch with a valid
session (SC-002).

**Constraints**:

- Workers free tier: 3 MiB compressed Worker, no paid add-ons.
- No Proxy or middleware (unsupported by OpenNext).
- No cookie writes during Server Component render.
- Baseline migration creates no tables.

**Scale/Scope**: One user. Four routes (`/`, `/sign-in`, `/fitness-tracker`, not-found) and
three route handlers.

No NEEDS CLARIFICATION items remain; research R1–R12 resolved them.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / section              | Status                         | How the design complies                                                                                                                                                                                                                                                          |
| -------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Simplicity First              | ✅                             | Two runtime dependencies, each with a present need (R3, R4). No session table, no data layer, no repository, no `src/features/`, no Proxy. Drizzle is deferred until it has a schema to own (see Complexity Tracking).                                                           |
| II. Server-Mediated Data Access  | ✅                             | The browser talks only to pages and `/api/auth/*`. D1 is reachable only through the Worker binding, and nothing reads it yet.                                                                                                                                                    |
| III. Session/Identity Separation | ✅ with one recorded exception | Google is used for identity only (`openid email profile`). No Google token is kept server-side or client-side. The browser holds only `session`: `HttpOnly`, `SameSite=Lax`, a 90-day persistent cookie. `Secure` is omitted on plain-HTTP localhost only (Complexity Tracking). |
| IV. Free-Tier Hosting            | ✅                             | A single Worker serves pages and server, with D1 and no R2 cache. The bundle size is checked against 3 MiB (quickstart §5).                                                                                                                                                      |
| V. Self-Documenting Code         | ✅                             | All user-facing text goes in `src/lib/strings/`, styles in CSS Modules, and no comments. The SQL baseline holds a single statement and no comment.                                                                                                                               |
| Technology Stack                 | ⚠ justified                    | Matches, except that Drizzle is not yet introduced (Complexity Tracking).                                                                                                                                                                                                        |
| Development Workflow             | ✅                             | The acceptance spec is written first and red (`e2e/app-foundation.spec.ts`). Logic is Vitest-driven. Route handlers are unit-tested by direct call with injected dependencies. Finishes with `scripts/check.ps1` exiting 0.                                                      |

**Post-design re-check** (after research, data model and contracts): unchanged, and all gates
pass with the two justified entries below.

## Project Structure

### Documentation (this feature)

```text
specs/001-app-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http.md
│   └── configuration.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                    # unchanged
│   ├── page.tsx                      # landing: requireSession, feature cards, sign-out form
│   ├── page.module.css
│   ├── page.test.tsx                 # updated for the presentational landing component
│   ├── sign-in/
│   │   ├── page.tsx                  # sign-in screen, error message, redirect if signed in
│   │   └── page.module.css
│   ├── fitness-tracker/
│   │   ├── page.tsx                  # requireSession + placeholder + back link
│   │   └── page.module.css
│   └── api/auth/
│       ├── google/route.ts           # GET: start sign-in
│       ├── google/callback/route.ts  # GET: complete sign-in
│       └── sign-out/route.ts         # POST: clear session
├── lib/
│   ├── features.ts                   # feature registry (one entry)
│   ├── return-to.ts                  # same-origin path validation
│   ├── session-token.ts              # sign/verify session JWT; pure, secret passed in, shared with e2e
│   ├── server/
│   │   ├── config.ts                 # reads and validates the four variables
│   │   ├── session-cookie.ts         # cookie names/attributes, requireSession (thin adapter)
│   │   └── google-sign-in.ts         # Arctic client, owner check, callback outcome logic
│   └── strings/
│       ├── app.ts                    # existing
│       ├── features.ts               # fitness tracker title/description/placeholder text
│       └── auth.ts                   # sign-in screen, error messages, sign-out label
e2e/
├── app-foundation.spec.ts            # acceptance test, written first
├── session.ts                        # helper: mint session cookie from .env.local
└── home.spec.ts                      # removed; superseded by app-foundation.spec.ts
migrations/0001_baseline.sql
wrangler.jsonc
next.config.ts                        # + initOpenNextCloudflareForDev()
README.md                             # rewritten per FR-017
docs/architecture/004-hosting-and-persistence.md
```

**Structure Decision**: A single Next.js App Router project, following the folder conventions in
`docs/04-react-and-nextjs.md`. Each `*.test.ts` sits beside the module it tests. Pure logic lives
in `src/lib/`; the `next/headers` and `redirect` calls stay in the thin `session-cookie.ts`
adapter and the route files, per ADR 003. `src/components/` and `src/features/` are still not
created, because nothing occupies them yet.

## Documentation the constitution amendment left stale

These files still describe Google Sheets or "hosting undecided". They are updated in this feature
because its code makes them wrong:

- `CLAUDE.md`: the Project and Project state sections.
- `docs/03-typescript.md` and `docs/04-react-and-nextjs.md`: Sheets examples become D1, and the
  `lib/server/` description.
- `docs/architecture/001-application-foundation.md`: the "Hosting still undecided" section points
  to 004.
- `docs/architecture/002-testing-strategy.md` and `003-development-workflow.md`: Sheets wording
  becomes the database.
- New `docs/architecture/004-hosting-and-persistence.md`: records R1, R2, R4, R8 and the Drizzle
  deferral.
- `.gitignore`: add `.dev.vars`.

## Complexity Tracking

| Violation                                                                                                       | Why Needed                                                                                                                                                                                                                                                  | Simpler Alternative Rejected Because                                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Drizzle ORM not used for the baseline migration (Technology Stack names it the source of schema and migrations) | The spec forbids any schema. `drizzle-kit generate` requires a schema file, and its per-migration folder layout does not match Wrangler's flat `migrations_dir`. Drizzle is introduced with the first table, where that layout decision has substance (R8). | An empty schema module to satisfy drizzle-kit adds a file and a dependency with no occupant, which Principle I forbids.             |
| Session cookie lacks `Secure` on `http://localhost` (Principle III)                                             | The registered local Google redirect URI is plain-HTTP localhost, and Playwright's WebKit does not reliably keep `Secure` cookies there (R5). Deployed responses are always HTTPS, so the cookie is always `Secure` in production.                          | Local HTTPS needs a second registered redirect URI and certificate trust in WebKit. It remains an option later with no code change. |
