# Quickstart: validating the Fitness Tracker UI

How to prove the feature works, from the inner loop to the phone. Commands run from the repository root
in PowerShell 7. Details of what is checked are in [spec.md](spec.md), [data-model.md](data-model.md)
and the [contracts](contracts/).

## Prerequisites

- `npm install`, and `npm run e2e:install` once.
- `.env.local` with `SESSION_SECRET` (the e2e session helper signs with it).
- Apply the migrations to the **local** database that `next dev` uses:

      npx wrangler d1 migrations apply onestopshop --local

  Run it again after pulling new migrations. It is a no-op when nothing is pending.

## 1. The gate

    pwsh -NoProfile -File scripts/check.ps1

Expect exit `0`: format, lint, typecheck, and the `node`, `dom` and `storage` Vitest projects. The gate
covers:

- **Pure rules**: `blockStatuses`, `decideSkip`, the reworked `decideAfterFinish` and `reevaluateAfterEdit`,
  `isPlannedSetLogged`, and `parseKgInput` / `formatKg`.
- **Storage**: every changed operation, including spec 002's rewritten cycle tests, plus the handler tests
  for each endpoint in the HTTP API contract.
- **Screens**: each screen's rendering and empty states, with its text taken from `fitnessStrings`.

Never run two Vitest invocations at once, because the storage setup wipes `.wrangler/test-state`. For one
storage file:

    npx vitest run --project storage <path>

## 2. The migration on realistic data

`cycle-migration.storage.test.ts` builds the pre-feature shape with raw SQL:

- a program with a completed cycle, an ended-early cycle and an active one
- a paused program with only ended cycles
- a deleted program's orphan sessions
- a program whose cycle points past its last block

It then applies `0003_cycle_container_data.sql` and checks the five steps in data-model.md. A dry run
against a copy of the real local database is also worthwhile:

    Copy-Item -Recurse .wrangler/state .wrangler/state-backup
    npx wrangler d1 migrations apply onestopshop --local
    npx wrangler d1 execute onestopshop --local --command "SELECT program_id, pass, current_block_id FROM cycles"

Expect exactly one row per program, with each `current_block_id` set. Restore from the backup if not.

## 3. The acceptance test (outer loop)

    pwsh -NoProfile -File scripts/e2e.ps1 -Path e2e/fitness-tracker.spec.ts

The test is written first, and expected to **fail** at the start for the intended reason: the Programs
link or page doesn't exist. It passes unmodified when the feature is done (research R16). Then run the
whole suite, so that the updated `app-foundation.spec.ts` passes too:

    pwsh -NoProfile -File scripts/e2e.ps1

## 4. On the phone

Start the dev server on the LAN as the `run-app` skill describes, open it in iPhone Safari, add it to the
Home Screen, and launch it standalone. Then walk through:

| Check                                                                                     | Expect                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Open the fitness tracker                                                                  | The weigh-in row is first. Weigh in 74,2 with the decimal keypad's comma; "Last entry: 74.2 kg" appears and the button disables |
| Build "Strength" with 4 blocks, 1 workout, 2 slots; set block 1 to 3 × 12 with quick fill | The summary reads "3×12 · 3×10 · 3×10 · 3×10" when the slot was created with 3 × 10                                             |
| Activate, open the active program, open the block, start the workout                      | It reaches the session in at most 4 taps from the Home Screen (SC-002)                                                          |
| Log each set without typing                                                               | One tap per set (SC-001). Rows turn read-only                                                                                   |
| Type a weight, go back, reopen the workout                                                | The typed value is still there (FR-021)                                                                                         |
| A workout of 10 exercises × 5 sets                                                        | The prefilled session shows within about 1 s (SC-008)                                                                           |
| Skip to block 3, then Pause, then Activate again                                          | Block 2 shows as skipped; after reactivating, block 3 is still current                                                          |
| Rotate and scroll every view at 375 px                                                    | No horizontal scrolling (SC-005), and Finish workout stays reachable                                                            |
| Switch the phone to dark mode                                                             | Every view stays legible, including the highlights and the optional style                                                       |

## 5. Before merging

- The Worker size is still within the free plan: `npx opennextjs-cloudflare build`, then
  `npx wrangler deploy --dry-run`.
- Read the generated SQL of `0002` and `0004` in the PR. Merging applies them to the remote database
  (005).
- Write `docs/architecture/007-cycle-as-container.md`, recording FR-045, the identity-based blocks
  (research R3) and the three-step migration (research R5). Record any change of the constitution's
  incremental decisions there too.
