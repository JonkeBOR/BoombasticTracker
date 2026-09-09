# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BoombasticTracker is a personal **Next.js / React / TypeScript** web app and PWA, installed on the
developer's iPhone Home Screen. Fitness tracking — strength training and bodyweight metrics, and
trends derived from historical data — is its first feature, not the whole product. Keep routes,
folders and shared code feature-agnostic unless something genuinely belongs to one feature.

- Persistence is a **Google Sheet** via the Google Sheets API, accessed **only** server-side.
- Next.js also acts as the **BFF**: the browser calls `/api/*`, never Google.
- Auth is **Google OAuth**, exchanged for a separate long-lived application session cookie.
- Hosting must stay within a genuinely **free tier**.

The binding principles are in [constitution.md](.specify/memory/constitution.md) — Simplicity First
is non-negotiable. Cross-cutting architecture decisions are recorded in
[docs/architecture/](docs/architecture/).

## Project state

The application foundation exists: Next.js 16 App Router under `src/`, a single landing page at
`/`, design tokens plus a dark-mode re-declaration in `src/app/globals.css`, CSS Modules beside the
code that uses them, user-facing text in `src/lib/strings/`, and a typed `src/app/manifest.ts` with
icons and iOS metadata so the app installs to the Home Screen and launches in standalone mode.

Not built yet: Google OAuth, the application session cookie, `src/lib/server/`, Google Sheets
access, any `/api/*` route handler, `src/components/`, `src/features/`, tests, CI, and a chosen
hosting provider. Those directories are created when they have a real occupant, not before.

## Commands

Prefer these scripts over calling the tools directly — they return a compact summary and meaningful
exit codes instead of raw tool output.

    pwsh -NoProfile -File scripts/check.ps1        # format + lint + typecheck
    pwsh -NoProfile -File scripts/check.ps1 -Fix   # fix what can be fixed, then report
    pwsh -NoProfile -File scripts/lint.ps1
    pwsh -NoProfile -File scripts/format.ps1 -Write
    pwsh -NoProfile -File scripts/typecheck.ps1

Add `-Json` for machine-readable output, `-MaxIssues <n>` to cap the listing, `-Help` for usage.
Exit codes: `0` passed or nothing to check, `1` issues found, `2` the check could not run.

Equivalent raw commands exist as `npm run lint`, `lint:fix`, `format`, `format:check`, `typecheck`.

The app itself runs through npm:

    npm run dev                 # next dev (Turbopack) on http://localhost:3000
    npm run build               # next build; also type-checks with the local tsc
    npm run start               # serve the production build
    npm run dev -- -H 0.0.0.0   # expose on the LAN for iPhone testing

`next lint` no longer exists in Next 16; ESLint runs through `scripts/lint.ps1` or `npm run lint`.

Requires Node.js >= 20.11 and PowerShell 7 (`pwsh`); run `npm install` first.

**Finish every code change with `scripts/check.ps1` exiting 0.**

## Testing on the iPhone

    npm run dev -- -H 0.0.0.0

Then open the phone's Safari at `http://<lan-ip>:3000`. The dev server prints the address as
`Network:` on startup — it was `http://192.168.0.46:3000` on this machine, but a DHCP lease can
move it, so trust the printed value over this one.

Expect a Next.js cross-origin dev warning on first load. The fix is `allowedDevOrigins:
['192.168.0.46']` in `next.config.ts` — hostname only, no scheme and no port.

The LAN check proves layout, safe-area insets and icons. It does **not** prove standalone launch:
Safari's manifest handling on an insecure origin is not something Apple documents, so the
chrome-less Home Screen launch is only properly provable from an HTTPS origin. Deploy before
concluding the PWA works.

## Guidelines

Read these before writing code. They are enforced by ESLint where enforceable.

- [01-general-guidelines.md](docs/01-general-guidelines.md) — no comments, no inline CSS, no bare
  strings in markup.
- [02-tooling-and-scripts.md](docs/02-tooling-and-scripts.md) — the scripts, switches, exit codes.
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
