# 002 — Testing strategy

**Status**: accepted; superseded in part by 003
**Date**: 2026-09-10

## Context

The application foundation exists but no feature does. The next feature is Google OAuth plus
Google Sheets access, which lands as `async` Server Components and `/api/*` route handlers.

Principle I defers "testing strategy" until it is actually needed. This record decides it now and
says plainly why that departure is being made.

## Decision

### Two frameworks, split by what each can reach

**Vitest** for unit tests: pure functions, string modules, synchronous Server Components and
Client Components. Colocated as `src/**/*.test.tsx`, matching the repository's existing habit of
putting `page.module.css` beside `page.tsx`.

**Playwright** for end-to-end tests, in `e2e/*.spec.ts`. This is not redundancy. Next.js
documents that Vitest cannot render `async` Server Components and that E2E is the supported answer
— and `async` Server Components are exactly the shape the first feature takes. The suites are kept
disjoint by construction: Vitest collects only `src/**/*.test.{ts,tsx}`, Playwright only `e2e/`.

003 refines this split from a capability question into a loop question, and settles one case this
record left open: route handlers are plain functions over Web `Request`/`Response`, so they
unit-test in Vitest rather than over HTTP.

### One browser: mobile WebKit

The deployment target is iPhone Safari and nothing else, so only WebKit is installed, under the
`iPhone 17` device profile. Chromium and Firefox would add download size and maintenance for
coverage of browsers this app is never opened in.

### Unit tests are in the quality gate; end-to-end tests are not

`scripts/check.ps1` runs format, lint, typecheck and Vitest. The repository has exactly one
enforcement point, backed by an unusually strong mandate, and a suite outside that point is a
suite that rots. Vitest costs roughly one second warm, which is small against a gate that already
runs ESLint with type information.

`scripts/e2e.ps1` stays outside it. Tens of seconds, a downloaded browser and a spawned HTTP
server do not belong in a gate that runs after every edit, and a flaky suite there would erode the
credibility of "must exit 0".

### The browser MCP is for exploring, not asserting

`.mcp.json` configures `@playwright/mcp` as mobile WebKit against the same port and the same
device profile as the E2E project, so what the agent sees matches what the E2E suite sees. It is
for answering "what is on the page right now". A check worth repeating gets promoted into
`e2e/*.spec.ts`.

## Consequences

Node.js 22.12 is now the floor, raised from 20.11: Vitest 5 and the Vite 8 it depends on both
require it.

`vite-tsconfig-paths` was evaluated and rejected — Vite 8 resolves `tsconfig` paths natively via
`resolve.tsconfigPaths`, so the plugin would have been a dependency earning nothing.

Deliberately not adopted, each because nothing needs it yet: coverage tooling, custom matchers
such as `@testing-library/jest-dom`, a component-testing layer, and CI.

## The departure from Principle I, stated honestly

Principle I lists testing strategy among the decisions to defer, and this adds two frameworks
before the first feature exists, to test a single static page. On the plain text of the
constitution, that is speculative. It is taken now for three reasons:

1. The next feature is the exact case Next.js documents as untestable by unit tests, so the E2E
   capability is needed when that feature lands, not after it.
2. The browser the agent will drive to verify that feature is Playwright's either way. Adopting
   Playwright for tests adds one config file to a browser stack the repository needs regardless.
3. Retrofitting tests onto auth and network code costs materially more than starting with a
   working harness on a trivial page.

The cost is bounded on purpose: one browser, one E2E spec, one unit test, no coverage tooling, no
custom matchers, no CI. Principle I is satisfied on shape and knowingly stretched on timing. If
the first feature ships without either suite catching anything, that is evidence to reconsider —
not evidence to expand.
