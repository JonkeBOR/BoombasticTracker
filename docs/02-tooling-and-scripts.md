# Tooling and Scripts

## What is installed

| Tool                   | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| ESLint 9 (flat config) | Correctness and convention rules, including the `docs/01` rules             |
| Prettier               | All formatting; ESLint never fights it (`eslint-config-prettier` runs last) |
| TypeScript             | Type checking via `tsc --noEmit`; the app is never built by these scripts   |

Configuration lives in `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore` and `tsconfig.json`.

ESLint is pinned to the 9.x line because `eslint-plugin-jsx-a11y` does not yet support ESLint 10.

## Scripts

Prefer these over calling the tools directly. They print a one-line summary plus one line per
problem instead of raw tool output, which is why they exist: an agent reads a short result rather
than loading whole configs and stack traces into context.

    pwsh -NoProfile -File scripts/check.ps1        # format + lint + typecheck
    pwsh -NoProfile -File scripts/lint.ps1
    pwsh -NoProfile -File scripts/format.ps1
    pwsh -NoProfile -File scripts/typecheck.ps1

Common switches, supported by every script:

| Switch           | Effect                                                          |
| ---------------- | --------------------------------------------------------------- |
| `-Json`          | Emit one compact JSON object instead of text                    |
| `-MaxIssues <n>` | Cap how many problems are listed (default 50)                   |
| `-Help`          | Usage text, no work performed                                   |
| `-Fix`           | `lint.ps1` and `check.ps1`: apply auto-fixable fixes first      |
| `-Write`         | `format.ps1`: rewrite unformatted files instead of listing them |
| `-Path <paths>`  | `lint.ps1` and `format.ps1`: restrict the run to specific paths |

## Exit codes

Branch on the exit code rather than parsing the text.

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| 0    | Passed, or skipped because there is nothing to check yet       |
| 1    | The check ran and found issues                                 |
| 2    | The check could not run (missing toolchain, unreadable output) |

`check.ps1` reports the worst code of the three.

## Output shape

    FORMAT: PASS  unformatted=0
    LINT: FAIL  errors=2 warnings=0 files=1
      src/app/page.tsx:2:15 error react/forbid-dom-props Prop "style" is forbidden on DOM Nodes
      src/app/page.tsx:2:40 error react/jsx-no-literals Strings not allowed in JSX files: "Hello"
    TYPECHECK: SKIP  no TypeScript sources yet

`SKIP` is only produced by `typecheck.ps1`, and only while the repository contains no `.ts`/`.tsx`
files at all. It disappears on its own once the application exists.

## Which to run when

- After editing any source file: `check.ps1`.
- After a change that is purely formatting-shaped: `format.ps1 -Write`.
- Before concluding a task: `check.ps1` must exit 0.

## npm scripts

`npm run lint`, `lint:fix`, `format`, `format:check` and `typecheck` invoke the same tools with raw
output. They exist for editor integration and CI. Prefer the PowerShell scripts when working in a
session, for the reason above.

## Requirements

Node.js 20.11 or newer, npm, and PowerShell 7 (`pwsh`). Windows PowerShell 5.1 is not supported by
these scripts. Run `npm install` before the first use; every script reports
`ERROR ... run 'npm install' first` rather than failing obscurely when dependencies are missing.
