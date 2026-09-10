---
name: 'test'
description: 'Choose and run the right kind of test in BoombasticTracker - Vitest unit tests, Playwright end-to-end tests, or the Playwright MCP browser for exploratory checks. Use when writing tests, running tests, or verifying behaviour in a real browser.'
argument-hint: 'Optional: unit | e2e | browse'
user-invocable: true
disable-model-invocation: false
---

# Testing in this repo

## Which tool

| Situation                                                                      | Tool           |
| ------------------------------------------------------------------------------ | -------------- |
| Pure function, string module, sync Server Component, Client Component          | Vitest         |
| `async` Server Component, route handler over HTTP, navigation, real layout     | Playwright     |
| One-off "does this look right, what is on the page" during development         | Playwright MCP |

Vitest cannot render `async` Server Components. This is a documented Next.js limitation, not a
configuration problem - see `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`.
Reach for Playwright instead of trying to make it work.

The MCP browser is for exploring, not for asserting. When a manual MCP check becomes something you
would repeat, promote it into `e2e/*.spec.ts`.

## Unit tests (Vitest)

Colocated beside the code, `*.test.ts` / `*.test.tsx`. Only `src/**` is collected, so a Playwright
spec is never picked up by Vitest.

    pwsh -NoProfile -File scripts/test.ps1
    npm run test:watch

Import `test` and `expect` from `vitest` explicitly. Globals are off, because enabling them would
need a `types` entry in `tsconfig.json`, and adding one narrows type inclusion from "every
`@types` package" to "only these" - which would silently drop `@types/node` and `@types/react`.

CSS Modules need no configuration. Vitest's `css` option defaults to `false`, which still returns
a proxy for `*.module.css`, so `styles.main` resolves and the component renders.

Assert against `appStrings` rather than a duplicated literal. That keeps tests inside the
no-bare-strings discipline and makes them real regression tests for the strings wiring.

## End-to-end tests (Playwright)

`e2e/*.spec.ts`, one project: `mobile-safari`, the `iPhone 17` device profile on WebKit, because
the deployment target is iPhone Safari and nothing else.

    pwsh -NoProfile -File scripts/e2e.ps1
    npm run e2e

Playwright boots `npm run dev` itself and reuses an already-running server on port 3000. The dev
server is deliberate rather than a production build: it keeps one server shared with the MCP loop,
and Server Components still render for real.

The first run needs `npm run e2e:install` (WebKit only, ~90 MB). `e2e.ps1` exits 2 with that
instruction if the browser is missing.

The `@/*` alias resolves inside `e2e/`, so import strings from `@/lib/strings/app` as usual.

## Playwright MCP

Configured in `.mcp.json` as mobile WebKit, pinned to `@playwright/mcp@0.0.80`. `--mobile`
emulates iPhone 17 under WebKit, the same viewport the E2E project uses.

The MCP does **not** start the app. The loop is:

1. `npm run dev` in the background (the `run-app` skill).
2. `browser_navigate` to http://localhost:3000.
3. `browser_snapshot` to read the accessibility tree, then `browser_click`, `browser_type`,
   `browser_take_screenshot`.
4. Edit code; Turbopack hot-reloads; re-snapshot. Do not restart the browser or the server.

The MCP pins its own `playwright-core`, which may be a different build from `@playwright/test`. If
it asks for a browser download on first launch, run the command it prints; the two builds coexist
and cost disk, not correctness.
