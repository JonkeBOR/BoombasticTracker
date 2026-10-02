# 003 — Development workflow

**Status**: accepted
**Date**: 2026-09-10

## Context

002 decided which testing tools exist and why. It did not decide how they are used while writing
code, and the project is now adopting test-driven development with a red-green-refactor cycle.

That adoption exposes a gap. 002 splits the tools by **what each can reach**: Vitest cannot render
`async` Server Components, so those go to Playwright. That is a true statement about capability
and a poor instruction for a development loop. In the App Router almost every page is an `async`
Server Component, so read literally the rule sends the red-green cycle into a tool that costs tens
of seconds and needs a dev server. A cycle that slow is not run often enough to drive anything, so
in practice the discipline would be abandoned within a feature or two and the tests would be
written afterwards, if at all.

The answer is not different tools. 002's choices are right and stay. The answer is to say which
**loop** each tool serves, and to record the design pressure that keeps the fast loop reachable.

## Decision

### Two loops, not two frameworks

**The outer loop is Playwright, once per feature.** One acceptance test in `e2e/*.spec.ts`,
written first, phrased as the behaviour wanted from the phone. It goes red when the feature starts
and green when the feature is finished. It is run at those two moments and is not iterated in.

**The inner loop is Vitest, continuously.** This is the actual red-green-refactor: a failing test,
the smallest code that passes it, then a refactor under a green bar, many times an hour under
`npm run test:watch`.

The feature is done when the outer test passes without having been touched since it was written.

### Which tool

Default to Vitest. Reach for Playwright only for the three things Vitest genuinely cannot see:

1. `async` Server Components — the documented Next.js limitation behind 002.
2. Real runtime behaviour — a cookie surviving a redirect, middleware, navigation between routes,
   the app launching standalone from the Home Screen.
3. The wiring between them — that the page actually receives the data the server produced.

Everything else is Vitest, including **route handlers**. A route handler is a plain function over
the Web `Request` and `Response` APIs, so a test imports it and calls it directly. This corrects
002, which sent route handlers to Playwright. Two handler tests including a JSON body assertion
run in well under a second with no server involved.

### Keep logic out of the async shell

The `async` Server Component exemption looks broad enough to swallow the rule, and does not,
provided the async component stays thin: `await` the data, hand it to a synchronous component that
renders it. Domain logic then lives in `src/lib/` as ordinary functions, the presentational
component renders under Testing Library exactly as `src/app/page.test.tsx` already shows, and the
async shell holds nothing worth asserting beyond the wiring the outer test covers.

This turns 002's limitation into a design check worth stating plainly:

> If a business rule can only be tested through Playwright, the rule is in the wrong place.

The same move applies to route handlers. `cookies()` is async and reads from request scope, so a
handler that calls it directly fails outside the Next.js runtime with `` `cookies` was called
outside a request scope ``. Take the session as a parameter and keep the `next/headers` call in a
thin adapter at the edge; the handler then holds the logic and unit-tests without a server.

### What test-first binds, and what it does not

Test-first is expected for domain logic, route handlers, data mapping, validation, and the
behaviour of synchronous components.

Styling and layout are exempt. They are checked with the Playwright MCP browser and covered
incidentally by the outer test. A red-green cycle cannot express "this looks right on an iPhone",
and forcing the attempt produces assertions about class names and DOM structure that break on
every visual change while proving nothing. Naming the exemption is what keeps the rest of the rule
credible — an exemption that is written down is not a lapse.

### The database and OAuth

Test-driving network code usually motivates an abstraction to mock at. The constitution defers
"data/repository abstraction" explicitly, and that deferral wins: no repository layer is
introduced to make mocking convenient.

Instead the pure parts carry the tests — database row to domain type and back, validation, the
derived trends, response parsing — while the calls that actually reach the database or Google stay thin enough
that a single end-to-end path covers it. If that thin call ever grows logic worth asserting, that
is the concrete need which justifies revisiting this, and not before.

### Domain-only features

Constitution 2.1.0 adds a path for a feature that adds domain rules or stored data but no screen or
route the phone can reach. There is no phone-level behaviour for an outer Playwright test to
describe, so the spec's acceptance scenarios take its place. They are written first as Vitest
tests, confirmed failing for the intended reason, and the feature is done when they pass unmodified.
`specs/002-fitness-domain-model` is the first such feature.

In practice each user story starts by adding stub operations that throw `not implemented`, so the
tests fail on behaviour and not on a missing import, and then writing that story's acceptance tests.
The pure rules inside a story are driven by the ordinary inner loop. The first feature that exposes
the domain to the phone brings its own Playwright test.

Rules that need a database to prove, such as atomicity, immutability and profile isolation, live in
`*.storage.test.ts` files that run in a separate `storage` Vitest project against a real local D1.
See [006-domain-persistence.md](006-domain-persistence.md). The project is part of `check.ps1`, so
the gate covers it.

## Consequences

The quality gate is unchanged and the split now has a second reason behind it: the inner loop
belongs in `scripts/check.ps1` because it runs after every edit, and the outer loop belongs
outside it because it runs at feature boundaries.

That leaves a gap which is better written down than discovered. The outer test is red for the
whole life of a feature, and `check.ps1` does not run Playwright, so nothing prompts you about it.
The discipline is manual: run `scripts/e2e.ps1` when the feature starts, confirming it fails for
the reason intended rather than a typo, and again when the feature is finished. The obvious
mechanical fix is CI, which the constitution still defers.

The deferrals in 002 stand: no coverage tooling, no custom matchers, no component-testing layer,
no CI.

## The cost, stated honestly

Writing the outer test first means writing a Playwright spec against routes and text that do not
exist, which is slower and less satisfying than starting with the code. The return is that the
feature has a definition of done before it has an implementation, and that the definition is
written from the phone rather than from the module graph.

The narrower risk is the design check becoming a way to argue that awkward code is fine because a
test was found for it. The check runs the other way: reaching for Playwright to test a rule is
evidence about the code, not about the tools.
