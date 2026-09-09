# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BoombasticTracker is a personal fitness tracker, built as a **Next.js / React / TypeScript** web app
and PWA installed on the developer's iPhone Home Screen. It tracks strength training and bodyweight
metrics and derives trends from historical data.

- Persistence is a **Google Sheet** via the Google Sheets API, accessed **only** server-side.
- Next.js also acts as the **BFF**: the browser calls `/api/*`, never Google.
- Auth is **Google OAuth**, exchanged for a separate long-lived application session cookie.
- Hosting must stay within a genuinely **free tier**.

The full architecture is in
[Architecture-Auth](Specs/FitnessTracker/Architecture/Architecture-Auth) (no file extension). The
binding principles are in [constitution.md](.specify/memory/constitution.md) — Simplicity First is
non-negotiable.

## Project state

The lint/format/typecheck toolchain, the agent scripts and the guideline docs exist. **The
application itself does not exist yet** — there is no `src/`, no `next.config`, and `next`, `react`
and `react-dom` are not installed. `typecheck` therefore reports `SKIP` until the first `.ts` file
lands.

Because `package.json` already exists, `create-next-app` will refuse to scaffold here. The
foundation work adds `next`, `react`, `react-dom` and their types manually and creates
`src/app/` by hand.

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

Requires Node.js >= 20.11 and PowerShell 7 (`pwsh`); run `npm install` first.

**Finish every code change with `scripts/check.ps1` exiting 0.**

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
- New architecture or hosting decisions belong in `Specs/FitnessTracker/Architecture`, and any
  stack change must also be reflected in the constitution.
- Don't add a dependency, abstraction or service without a concrete present need.
- Update this file's Project state and Commands sections when the application foundation lands.
