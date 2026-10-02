# Quickstart: validating the fitness domain model

This guide shows how to check that the feature works. It has no screens, so validation is
automated tests plus a look at the local database. Details live in [data-model.md](data-model.md) and
[contracts/fitness-operations.md](contracts/fitness-operations.md).

## Prerequisites

- Node.js ≥ 22.12, PowerShell 7, `npm install` done.
- No Google credentials or sign-in are needed. Every check below runs without the app server.

## 1. Apply the schema locally

```powershell
npx drizzle-kit generate          # expect: "No schema changes" once the migrations are committed
npx wrangler d1 migrations apply onestopshop --local
npx wrangler d1 execute onestopshop --local --command "SELECT name FROM sqlite_master WHERE type IN ('table','trigger') ORDER BY name"
```

**Expect**: the eleven tables from the data model (`profiles` … `bodyweight_entries`) and the two
`set_logs` immutability triggers. `migrations/0001_baseline.sql` is gone, and drizzle's
`0000_…` files are present.

## 2. Run the acceptance tests

```powershell
npx vitest run --project node --project storage src/features/fitness-tracker
```

**Expect**: everything passes. The acceptance tests are named after the spec's scenarios, so the
output reads like the spec:

| Spec                                         | Proven by                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| User Story 1 (build a program)               | `server/programs.storage.test.ts`, `domain/program.test.ts`                                         |
| User Story 2 (train with prefill)            | `server/training.storage.test.ts`, `domain/logging.test.ts`                                         |
| User Story 3 (blocks and cycles)             | `server/training.storage.test.ts`, `domain/progression.test.ts`                                     |
| User Story 4 (edit without losing history)   | `server/history.storage.test.ts`                                                                    |
| User Story 5 (bodyweight)                    | `server/bodyweight.storage.test.ts`, `domain/bodyweight.test.ts`                                    |
| The 8 scenarios in `domain-spec.md` (SC-001) | one test each, named after the scenario                                                             |
| Rules 1–22 (SC-002)                          | each test title carries its rule number. `grep -rn "rule 1[^0-9]" src/features` and so on find them |
| SC-003, SC-004, SC-007                       | `server/history.storage.test.ts`, `server/isolation.storage.test.ts`                                |
| SC-005, SC-006                               | `server/performance.storage.test.ts`                                                                |

## 3. Confirm set logs can't be changed

```powershell
npx vitest run --project storage src/features/fitness-tracker/server/history -t "FR-033"
```

**Expect**: the test passes. It updates and deletes `set_logs` rows directly and expects both to fail
with `set_logs are immutable`. The check has to run against real rows, because a row-level trigger
never fires for a statement that matches none, so `UPDATE set_logs SET reps = 1` on an empty table
succeeds silently.

## 4. Run the gate

```powershell
pwsh -NoProfile -File scripts/check.ps1
```

**Expect**: exit code `0`. The gate runs the `storage` project as well. Note how long it takes; the
plan's budget is under 10 s more than before this feature.

## 5. Check the Worker still fits the free plan

```powershell
npx opennextjs-cloudflare build
npx wrangler deploy --dry-run
```

**Expect**: a compressed size well under 3 MiB (1.08 MiB before this feature, see 004).

## Done

The feature is done when the acceptance tests written at the start pass **unmodified**
(constitution 2.1.0, domain-only feature) and `scripts/check.ps1` exits 0.
