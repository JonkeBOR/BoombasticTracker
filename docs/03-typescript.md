# TypeScript Conventions

## Strictness

`tsconfig.json` runs `strict` plus `noUncheckedIndexedAccess`, `noImplicitOverride` and
`noFallthroughCasesInSwitch`. Do not weaken these. `noUncheckedIndexedAccess` in particular means
indexing an array yields `T | undefined` — handle the `undefined` rather than asserting it away.

## Never use `any`

`any` is banned by `@typescript-eslint/no-explicit-any`. When a type is genuinely unknown at a
boundary — a fetch response, a Google Sheets row, JSON from a request body — use `unknown` and
narrow it before use. Data crossing an external boundary is validated, not asserted.

## Avoid escape hatches

Do not reach for `as`, non-null `!`, or `@ts-expect-error` to silence the compiler. Each of these
turns a compile-time error into a runtime one. Prefer narrowing, a type guard, or fixing the type.
Where an escape hatch is genuinely unavoidable, it must be the narrowest possible expression.

## Types vs interfaces

Use `type` by default. Use `interface` only when declaration merging or `extends` on an object
contract is actually needed. Consistency matters more than the distinction.

## Naming

- Types, interfaces and components: `PascalCase`.
- Variables, functions and hooks: `camelCase` (hooks start with `use`).
- Constants that are true module-level literals: `SCREAMING_SNAKE_CASE`.
- Files exporting a component: match the component name. Everything else: `kebab-case`.

Names carry the meaning that comments are not allowed to add, so prefer `remainingRestSeconds` over
`time`. Booleans read as predicates: `isLoading`, `hasSession`, `canSubmit`.

## Exports

Prefer named exports. Default exports are used only where a framework requires them — Next.js
pages, layouts and route segment files.

## Module boundaries

Import application code through the `@/*` alias (`@/lib/sheets`) rather than long relative chains.
Relative imports are for siblings within the same feature folder.

Server-only modules — anything touching Google credentials, tokens or the Sheets API — must never
be imported from a Client Component. Keep them under a server folder and mark them with
`import 'server-only'` so the mistake fails at build time instead of leaking secrets to the browser.

## Async

Return types on exported async functions are explicit. Promises are always awaited or explicitly
handled; `@typescript-eslint/no-floating-promises` enforces this and is on by default through the
type-checked rule set.
