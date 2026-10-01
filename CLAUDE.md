# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OneStopShop is a personal **Next.js / React / TypeScript** web app and PWA, installed on the
developer's iPhone Home Screen. Fitness tracking — strength training and bodyweight metrics, and
trends derived from historical data — is its first feature, not the whole product. Keep routes,
folders and shared code feature-agnostic unless something genuinely belongs to one feature.

- Hosting is a single **Cloudflare Worker** on the free plan, built with OpenNext.
- Persistence is **Cloudflare D1** (SQLite), reached **only** through the Worker's `DB` binding;
  locally it is the SQLite file Wrangler keeps under `.wrangler/state/`.
- Next.js also acts as the **BFF**: the browser calls the app's pages and `/api/*`, never Google
  or the database.
- Auth is **Google OAuth for identity only**, exchanged for the app's own signed 90-day session
  cookie. No Google token is kept anywhere.

The binding principles are in [constitution.md](.specify/memory/constitution.md) — Simplicity First
is non-negotiable. Cross-cutting architecture decisions are recorded in
[docs/architecture/](docs/architecture/).

## Project state

The application foundation exists: Next.js 16 App Router under `src/`, a single landing page at
`/`, design tokens plus a dark-mode re-declaration in `src/app/globals.css`, CSS Modules beside the
code that uses them, user-facing text in `src/lib/strings/`, and a typed `src/app/manifest.ts` with
icons and iOS metadata so the app installs to the Home Screen and launches in standalone mode.

Testing exists: Vitest for unit tests colocated as `src/**/*.test.ts(x)` (a `node` project for
`src/lib/` and route handlers, a `jsdom` project for components), Playwright for end-to-end tests in
`e2e/` that sign in by minting a session cookie, and a Playwright MCP browser configured in `.mcp.json`.

Sign-in exists: `/sign-in`, the `/api/auth/*` route handlers, and `src/lib/server/` (config,
session cookie, Google sign-in). Every protected page calls `requireSession(path)`; there is no
Proxy, which OpenNext cannot run. The landing page lists features from `src/lib/features.ts`, and
the fitness tracker at `/fitness-tracker` is a placeholder. `wrangler.jsonc` configures the Worker
and the D1 binding, and `migrations/` holds a baseline that creates no tables. See
[004-hosting-and-persistence.md](docs/architecture/004-hosting-and-persistence.md).

Not built yet: any fitness data or schema, Drizzle ORM (deferred until the first table),
`src/components/`, `src/features/`, and CI. Those are created when they have a real occupant, not
before.

## Commands

    pwsh -NoProfile -File scripts/check.ps1        # format + lint + typecheck + unit tests
    pwsh -NoProfile -File scripts/check.ps1 -Fix   # fix what can be fixed, then report

Exit codes: `0` passed or nothing to check, `1` issues found, `2` the check could not run.

**Finish every code change with `scripts/check.ps1` exiting 0.**

Development is test-driven: a Vitest red-green-refactor inner loop, and one Playwright acceptance
test per feature written first. See
[003-development-workflow.md](docs/architecture/003-development-workflow.md).

`next lint` no longer exists in Next 16; ESLint runs through `scripts/lint.ps1` or `npm run lint`.

Requires Node.js >= 22.12 and PowerShell 7 (`pwsh`); run `npm install` first, and
`npm run e2e:install` before the first end-to-end run.

Detail lives in skills rather than here, so it loads only when it is needed:

- **check** — every script, switch, exit code and output shape.
- **run-app** — running, building and LAN-exposing the app, and iPhone Safari testing.
- **test** — choosing between Vitest, Playwright and the browser MCP.

## Guidelines

Read these before writing code. They are enforced by ESLint where enforceable. The tooling
reference that used to sit at `02` is now the `check` skill.

- [01-general-guidelines.md](docs/01-general-guidelines.md) — no comments, no inline CSS, no bare
  strings in markup.
- [03-typescript.md](docs/03-typescript.md) — strictness, no `any`, naming, module boundaries.
- [04-react-and-nextjs.md](docs/04-react-and-nextjs.md) — Server vs Client Components, data access,
  route handlers, folder structure.
- [05-styling-and-strings.md](docs/05-styling-and-strings.md) — CSS Modules, design tokens, string
  constants.

Two rules deserve emphasis because they are unusual and are hard errors:

- **Never add comments.** Encode intent in names and structure instead.
- **Never put a bare string in JSX.** `react/jsx-no-literals` rejects `<h1>Workouts</h1>` and
  `<h1>{'Workouts'}</h1>`; text comes from a constants module. Props are exempt.

"Never add comments" is not enforceable by any off-the-shelf ESLint rule, so it is the one
guideline a review has to catch by reading.

## Working in this repo

- Check what exists before assuming structure — most of the app is still unwritten.
- New architecture or hosting decisions belong in `docs/architecture/`, and any stack change must
  also be reflected in the constitution.
- Don't add a dependency, abstraction or service without a concrete present need.
- `src/app/page.tsx` with `src/app/page.module.css` and `src/lib/strings/app.ts` is the worked
  example of the conventions stack — Server Component, CSS Module, design tokens, no bare strings.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
