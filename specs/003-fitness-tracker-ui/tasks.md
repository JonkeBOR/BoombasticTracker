---
description: 'Task list for the fitness tracker UI'
---

# Tasks: Fitness Tracker UI

**Input**: Design documents from `specs/003-fitness-tracker-ui/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/http-api.md](contracts/http-api.md),
[contracts/operations-delta.md](contracts/operations-delta.md), [contracts/screens.md](contracts/screens.md),
[quickstart.md](quickstart.md)

**Tests**: Required. Development is test-driven (constitution, Development Workflow).

- **The outer loop**: this feature exposes the domain to the phone, so it opens with **one Playwright
  acceptance test**, written first and confirmed failing (T003). The feature is done when it passes
  **unmodified** (T084).
- **The inner loop**: every rule, operation, handler and component behaviour is driven by Vitest. Write the
  test, see it fail for the intended reason (a failed assertion, or an explicit `not implemented` throw,
  never a missing import or a type error), then implement.
- **Exempt**: styling and layout. They are checked in a real browser instead.

**Organization**: Setup, then the Foundational phase (the domain reshape and the BFF plumbing every screen
needs), then one phase per user story, then Polish. The story phases run in **dependency order**: US2,
US3, US4, US1, US5. US1 (P1) is the reason the tracker exists, but on the phone it needs a program
(US3) and activation (US4) first. See "Dependencies".

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1–US5, numbered as in spec.md)

## Conventions every task follows

Read these once. The tasks don't repeat them.

- **Repository rules**:
  - no comments in source
  - no `any`
  - no `as`, `!` or `@ts-expect-error` (narrow instead)
  - `type` over `interface`
  - named exports
  - `@/*` imports
  - explicit return types on exported async functions

  See `docs/03-typescript.md`.

- **No bare strings in JSX** (`react/jsx-no-literals`). All user-facing text comes from
  `src/lib/strings/fitness.ts` (`fitnessStrings`, `fitnessErrorStrings`). Tests look elements up by role
  and by those constants, never by literal text.
- **No inline CSS.** Each screen has a CSS Module beside it, using only tokens from `src/app/globals.css`.
  Tap targets are at least `var(--tap-target-min)`.
- **Pure domain**: files in `src/features/fitness-tracker/domain/` do no I/O, never import Drizzle or
  `server-only`, and never read the clock. Their tests are `*.test.ts` beside them (Vitest `node` project).
- **Server modules**: files in `src/features/fitness-tracker/server/` start with `import 'server-only';`,
  except `schema.ts`. They take `db: Database` first, then `profileId`. They filter by `profileId`, and a
  foreign ID behaves like a missing one (`not-found`). Every multi-row write is **one** `db.batch` (006).
- **Storage tests**: `*.storage.test.ts` files run in the `storage` project against a real local D1, using
  `openTestDatabase` (`server/storage-test-database.ts`) and the helpers in
  `server/storage-test-support.ts`. Each test creates its own profile with
  `ensureProfile(db, crypto.randomUUID(), now)`. **Never run two Vitest invocations at once.** For one
  file, use `npx vitest run --project storage <path>`.
- **Handlers**: each endpoint has a `handle…(context)` function in
  `src/features/fitness-tracker/server/handlers/<resource>.ts`, where `context` is the
  `FitnessRequestContext` from T028. Each has a `route.ts` under `src/app/api/fitness/…` that only does
  `export const POST = fitnessRoute(handle…)` (or the matching verb). The handlers' storage tests call
  `handle…` with a real `Request`, and assert the status and the JSON body for the success case and for
  **every** refusal listed for that row in [http-api.md](contracts/http-api.md).
- **Screens**: each page's `page.tsx` is a thin `async` Server Component. It calls
  `requireFitnessContext(path)` (T033), reads, and renders a synchronous `…Screen` component beside it.
  Screens and client components have `*.test.tsx` tests in the `dom` project, written first. Client
  components mock `fetch` with `vi.stubGlobal` and `next/navigation`'s `useRouter` with `vi.mock`.
- **Rule references**: tests that prove a spec requirement name it in their title, e.g.
  `it('FR-043: removing a block before the current one keeps the user on the same block', …)`. Tests that
  replace a spec 002 rule test keep the rule number and add the FR, e.g.
  `it('rule 7, FR-045: finishing the last block starts a new pass at block 1', …)`.
- **Finishing a task**: finish every code task with `pwsh -NoProfile -File scripts/check.ps1` exiting
  `0`. The only failure allowed while a story is in progress is the acceptance test (it isn't in the gate).

---

## Phase 1: Setup

**Purpose**: The definition of done, and the strings it needs.

- [x] T001 Create `src/lib/strings/fitness.ts` exporting `fitnessStrings` as a nested `as const` object with
      the final wording of every string the acceptance test (T002) uses:
  - **home**: title "Fitness Tracker", programs link "Programs", exercises link "Exercises", "Weigh in",
    a `lastEntry(kg: string)` function returning `Last entry: ${kg} kg`, "No active program"
  - **programs**: "Programs", "New program", label "Name", label "Blocks", "Create"
  - **programEdit**: "Add workout", label "Workout name", "Activate", "Active"
  - **workoutEdit**: "Add exercise", label "Exercise", option "New exercise…", label "New exercise name",
    label "Sets", label "Reps", "Save"
  - **activeProgram**: home card link "Open", "Current block"
  - **block**: a `blockComplete(n: number)` function returning `Block ${n} complete`, `programComplete`
    "Program complete, starting again at block 1"
  - **session**: a `weightLabel(setNumber)` function returning `Weight, set ${n}`, a `logLabel(setNumber)`
    function returning `Log set ${n}`, a `loggedLabel(setNumber)` function returning `Set ${n} logged`,
    "Finish workout"

  The rest of the strings are added by the tasks that need them. Keep `featureStrings` in
  `src/lib/strings/features.ts` as it is for now.

- [x] T002 Write the acceptance test `e2e/fitness-tracker.spec.ts` (research R16). Use `signIn(context)`
      from `e2e/session.ts`. Use a unique suffix `const run = Date.now().toString(36)`, so the test can be
      re-run against the persistent local database. Use roles and the `fitnessStrings` constants only. One
      `test`, with these steps:
  1. **Build a program.**
     - Go to `/fitness-tracker`, tap "Programs", then "New program".
     - Create `Program ${run}` with blocks set to `1`.
     - Expect the program edit page with a heading named `Program ${run}`.
  2. **Add a workout.** Add the workout `Day ${run}`, then open it.
  3. **Add a slot.**
     - Tap "Add exercise", choose "New exercise…" and type `Press ${run}`.
     - Set sets `1` and reps `5`, then Save.
     - Expect a list item containing `Press ${run}` and `1×5`.
  4. **Activate.** Go back to the program and tap "Activate". If a confirmation dialog appears because
     another program is active, confirm it. Expect the "Active" status.
  5. **Start the workout.**
     - Go to `/fitness-tracker`, and expect the active program card naming `Program ${run}`. Open it.
     - Open the current block, then tap the workout `Day ${run}`.
     - Expect the session heading to contain `Day ${run}`.
  6. **Log a set.**
     - Fill the textbox named `weightLabel(1)` with `42,5`, then tap the button named `logLabel(1)`.
     - Expect the text `loggedLabel(1)` and the text `42.5`.
  7. **Finish.** Tap "Finish workout", and expect the text `programComplete`.
  8. **Prefill.** Tap `Day ${run}` again, and expect the textbox `weightLabel(1)` to have the value `42.5`
     (FR-017 prefill across passes).
- [x] T003 Run `pwsh -NoProfile -File scripts/e2e.ps1 -Path e2e/fitness-tracker.spec.ts`, and confirm it
      fails at step 1 because there is no "Programs" link. That is the intended reason. A compile error,
      a crash or a sign-in failure is not, and must be fixed before moving on. Note the result in the
      PR description.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Reshape the cycle into a container with block identity (FR-045, FR-043, FR-042; research
R3–R5, R7), and build the plumbing every screen and handler uses.

**⚠️ No story work starts until the gate is green at the end of this phase.**

### Pure rules (domain)

- [x] T004 [P] Rewrite `src/features/fitness-tracker/domain/progression.test.ts` for the new rules before
      changing the code. Blocks are passed as an ordered list of IDs. Cover:
  - **`decideAfterFinish({ blockIds, currentBlockId, workoutIds, finishedWorkoutIdsInBlock })`**:
    - `none` while any workout is unfinished
    - `{ kind: 'advance', toBlockId }` for the next block by order
    - `{ kind: 'new-pass' }` after the last block
    - `none` for a program with no workouts
  - **`decideSkip({ blockIds, currentBlockId, targetBlockId })`**:
    - a later block gives `{ kind: 'move', toBlockId }`
    - the first block gives `{ kind: 'new-pass' }`, also when it is the current block
    - the current block when it isn't first, an earlier non-first block, or an unknown ID gives
      `invalid-block`
  - **`reevaluateAfterEdit({ blockIdsBefore, blockIdsAfter, currentBlockId, removedBlockId, workoutIds, finishedWorkoutIdsInCurrentBlock })`**,
    one test per row of the data-model transitions table:
    - an earlier block removed gives `none`
    - the current block removed when it wasn't last gives `move` to the block that followed it in
      `blockIdsBefore`
    - the current, last block removed gives `new-pass`
    - a later block removed gives `none`
    - a removed workout completing the current block gives `move` to the next block, or `new-pass` when
      it was the last block
    - otherwise `none`
  - **`blockStatuses({ blockIds, currentBlockId, workoutIds, finishedWorkoutIdsByBlock })`**: returns one
    `{ blockId, status, finishedCount }` per block in order.
    - the current block is `current`, and later blocks are `upcoming`
    - an earlier block is `complete` when every workout ID is finished in it, otherwise `skipped`
    - `finishedCount` counts only IDs in `workoutIds`

  Delete the tests of `decideActivation` and `decideStartOver`.

- [x] T005 Rework `src/features/fitness-tracker/domain/progression.ts` to make T004 pass:
  - export `decideAfterFinish`, `decideSkip`, `reevaluateAfterEdit` and `blockStatuses`, plus the types
    `FinishDecision`, `SkipDecision`, `EditDecision` and `BlockStatus = 'complete' | 'current' | 'upcoming' | 'skipped'`
  - keep `isBlockComplete`
  - delete `decideActivation`, `ActivationDecision` and `decideStartOver`
- [x] T006 [P] TDD `parseKgInput` and `formatKg` in `src/features/fitness-tracker/domain/values.ts`, with
      tests in `values.test.ts` (research R11).
  - **`parseKgInput(text)`** returns `Result<number | null, 'invalid-weight'>`:
    - trims; `''` gives `null`
    - accepts one `.` or `,` as the decimal separator
    - rejects more than two decimals (`'61.255'`), letters, signs, `'0'` and anything `parseWeightKg`
      rejects
    - `'61,25'` gives `61.25`
  - **`formatKg(kg)`**: `62.5` gives `'62.5'`, `60` gives `'60'`, `61.25` gives `'61.25'`, and `0.1 + 0.2`
    gives `'0.3'`. It rounds to at most 2 decimals, with no trailing zeros.
- [x] T007 [P] TDD `isPlannedSetLogged(session: Pick<SessionView, 'slots'>, plannedSetId)` in
      `src/features/fitness-tracker/domain/logging.ts`, with tests in `logging.test.ts` (research R9). It
      returns true when any slot's `loggedSets` has a log matching that planned set's slot and
      `setNumber`.
- [x] T008 [P] Rename `groupByBlockAcrossCycles` to `groupByBlockAcrossPasses` in
      `src/features/fitness-tracker/domain/history.ts`. It groups by `log.context.pass`, and the summary
      field becomes `pass`. Update `history.test.ts` and the operation that calls it.
- [x] T009 Update `src/features/fitness-tracker/domain/types.ts` to the shapes in data-model.md:
  - **`Cycle`** = `{ id, currentBlockId, pass }`
  - **`Program`**: `cycle: Cycle` replaces `activeCycle`
  - **`ProgramSummary`** adds `blockCount` and `workoutCount`
  - **New**: `BlockProgress`, `ExerciseUsage`
  - **`TrainingOverview`**:
    `{ program, currentBlock: { id, number, label, isLast }, blocks: BlockProgress[], workoutCount, workouts: { id, name, status, sessionId, finishedAt }[], suggestedWorkoutId }`
  - **`SessionView`**: `block: { id, number: number | null, label }` replaces `cycleNumber` and
    `blockNumber`
  - **`SetLogContext`**: `pass` replaces `cycleNumber`
  - **Delete** `CycleStatus`

  Type errors elsewhere are expected until T018–T024.

### Schema and migrations (research R5)

- [x] T010 Step 1 of the migration. In `src/features/fitness-tracker/server/schema.ts`:
  - add nullable `currentBlockId: text('current_block_id')` and `pass: integer('pass')` to `cycles`
  - add nullable `trainingBlockId: text('training_block_id')` and `pass: integer('pass')` to
    `workoutSessions`
  - change nothing else yet

  Run `npx drizzle-kit generate --name cycle_container_columns`. Check that
  `migrations/0002_cycle_container_columns.sql` contains only the four `ALTER TABLE … ADD` statements.

- [x] T011 Write `src/features/fitness-tracker/server/cycle-migration.storage.test.ts` first (quickstart
      §2). It opens its **own** D1, through Wrangler's `getPlatformProxy` with
      `persist: { path: '.wrangler/test-state/migration-v3' }`, deleted at the start of the test.
  - **Bring the database to the old shape**: apply the SQL of `0000`, `0001` and `0002` in order. Split
    each file on `--> statement-breakpoint`, then run the statements through the binding.
  - **Insert old-shape rows with raw SQL**:
    - **A**: a program with blocks 1–3, a completed cycle 1, an ended-early cycle 2 and an active
      cycle 3 on block 2, with finished sessions in each
    - **B**: a paused program with only an ended-early cycle 1 on block 3
    - **C**: a program with no cycle
    - **D**: an active cycle whose `current_block_number` is 4 while the program has 3 blocks
    - orphan sessions for a deleted program, with the same `workout_id` in blocks 1 and 2
  - **Apply** `0003_cycle_container_data.sql`, then assert data-model.md's steps 1–5:
    - one cycle per program
    - A keeps cycle 3's ID, with `pass 3` and `current_block_id` = block 2
    - B has `pass 1` on block 3
    - C has a new cycle with `pass 1` on block 1
    - D is on the last block
    - every session of A and B points at the kept cycle, with `pass = old cycle_number` and the right
      `training_block_id`
    - orphans get `'removed-1'` and `'removed-2'`
  - **Apply `0004`** and assert it succeeds. Set log rows are byte-for-byte unchanged.

  The test fails until T012 and T013 exist.

- [x] T012 Run `npx drizzle-kit generate --custom --name cycle_container_data`, and write
      `migrations/0003_cycle_container_data.sql` as plain SQL statements separated by
      `--> statement-breakpoint`, implementing data-model.md's steps 1–5 in order:
  1. Choose the kept cycle per program: `status = 'active'`, otherwise `MAX(number)`.
  2. Update the sessions: `pass`, `cycle_id` and `training_block_id`, using
     `'removed-' || block_number` when there's no block at that position.
  3. Update the kept cycles' `pass` and `current_block_id`, using the highest-position block when
     `current_block_number` exceeds the block count.
  4. Delete the other cycles.
  5. Insert the missing cycles, using `lower(hex(randomblob(16)))` as the ID.

  No comments in the SQL.

- [x] T013 Step 3 of the migration. Finalise `schema.ts`:
  - **`cycles`**: `id`; `programId` unique, `ON DELETE CASCADE`; `currentBlockId` text not null;
    `pass` integer not null. Drop `number`, `status`, `currentBlockNumber`, `startedAt` and `endedAt`,
    and their indexes. Add `uniqueIndex('cycles_program').on(table.programId)`.
  - **`workoutSessions`**: `pass` and `trainingBlockId` not null. Drop `cycleNumber` and `blockNumber`,
    and the old index. Add `uniqueIndex('workout_sessions_cycle_pass_block_workout').on(cycleId, pass, trainingBlockId, workoutId)`.
  - **`setLogs`**: rename the property `cycleNumber` to `pass: integer('cycle_number').notNull()`, so the
    SQL column is unchanged.
  - Delete `cycleStatuses`.

  Run `npx drizzle-kit generate --name cycle_container_schema`. Read `0004_cycle_container_schema.sql` and
  confirm three things: it doesn't touch `set_logs`, which would drop the immutability triggers (if it
  does, stop and fix the schema so drizzle sees no change there); it rebuilds `cycles` and
  `workout_sessions` with `PRAGMA foreign_keys=OFF/ON` around the copy; and it creates both new indexes.
  T011 must now pass.

- [x] T014 Apply the migrations to the local development database with
      `npx wrangler d1 migrations apply onestopshop --local`, after backing up `.wrangler/state` as in
      quickstart §2. Check that `SELECT program_id, pass, current_block_id FROM cycles` has one row per
      program.

### Operations (FR-045, FR-043, FR-042; operations-delta.md)

- [x] T015 Update `src/features/fitness-tracker/server/storage-test-support.ts`. `createProgramFromSpec`
      returns block IDs in order. Add `activeOverview(db, profileId)`, which returns
      `getTrainingOverview` or throws. Add `finishBlock(db, profileId)`, which starts and finishes every
      workout of the current block.
- [x] T016 Rewrite `src/features/fitness-tracker/server/cycles.storage.test.ts` to the data-model
      transitions table **before** changing the operations. The replaced spec 002 tests keep their rule
      numbers and add `FR-045`.
  - **Rule 7, FR-045**: finishing the last block starts a new pass at block 1, and the earlier pass's
    finished workouts no longer count.
  - **Rule 2, FR-045**: pausing keeps the current block. Reactivating continues there, with the finished
    workouts still finished. Pausing closes an in-progress session as finished.
  - **Rule 2, FR-045**: activating program B keeps A's position, and closes A's in-progress session.
  - **Rules 3–4, FR-045**: `createProgram` gives the program exactly one cycle at pass 1 on the first
    block. Activating it changes no cycle row. Activating the active program changes nothing.
  - **Rule 13, FR-045**: a new pass closes in-progress sessions of the old pass.
  - **Rule 1** is kept as it is.
  - **Remove** "rule 4: at most one active cycle" and "rule 5: numbering". Replace them with: inserting a
    second cycle for a program directly is rejected by the unique index.
  - **Rule 14**: prefill in pass 2 shows the weights logged in pass 1.
  - **Rule 20** is kept.
- [x] T017 [P] Add the FR-043 and FR-042 tests to `src/features/fitness-tracker/server/programs.storage.test.ts`,
      one per transitions-table row, for both an **active** and a **paused** program:
  - removing an earlier block keeps `cycle.currentBlockId`, and `getTrainingOverview` shows the same
    block under its new number
  - removing the current block moves to the following block, with `finishedCount` 0
  - removing the current, last block starts a new pass on the first block, even when an earlier block
    has no finished sessions
  - removing a later block changes nothing
  - removing a workout that is in progress closes its session as finished, and keeps its set logs
  - removing the only unfinished workout moves to the next block
  - moving blocks keeps `currentBlockId` and the finished workouts

  Update the existing tests in that file to the new `Program.cycle` shape.

- [x] T018 Rewrite `src/features/fitness-tracker/server/cycle-statements.ts`:
  - **`closeInProgressStatements(db, programId, now)`**: sets every `in_progress` session of the program to
    `finished` at `now`.
  - **`startPassStatements(db, cycle, firstBlockId, now)`**: the close statements, plus an update to
    `pass + 1` and `current_block_id = firstBlockId`.
  - **`insertCycleStatement(db, programId, firstBlockId)`**: `pass 1`.

  Delete `endCycleStatements` and `startCycleStatement`.

- [x] T019 Update `src/features/fitness-tracker/server/mapping.ts`:
  - **`toCycle`**: `{ id, currentBlockId, pass }`
  - **`toSetLog`**: `context.pass` from the row's `pass`
  - **`toProgram`**: `cycle` from the single cycle row; throw if it is missing

  Update `mapping.test.ts`.

- [x] T020 Update `src/features/fitness-tracker/server/programs.ts`:
  - **`createProgram`**: adds `insertCycleStatement` for the first block to its batch.
  - **`loadProgramRows` and `getProgram`**: return `cycle`.
  - **`progressionAfterEdit`**: replace it with `reevaluateProgramCycle(db, programId, { blockIdsBefore, blockIdsAfter, removedBlockId, workoutIds }, now)`.
    It loads the program's cycle, whether the program is active or not. It reads the finished
    `workoutId`s for `(cycle.id, cycle.pass, cycle.currentBlockId)`, calls `reevaluateAfterEdit`, and
    returns statements:
    - an update of `current_block_id` for `move`
    - `startPassStatements` for `new-pass`
  - **`removeTrainingBlock`** and **`removeWorkout`** use it. `removeWorkout` also adds an update closing
    `in_progress` sessions with that `workout_id`, in the same batch (FR-042).

  T017 must pass.

- [x] T021 Update `src/features/fitness-tracker/server/activation.ts`:
  - **`activateProgram`**: keeps `program-incomplete`. When another program is active, it adds that
    program's `closeInProgressStatements`. It sets `active_program_id` and returns the program's `Cycle`.
    It never inserts or ends a cycle.
  - **`pauseActiveProgram`**: closes the active program's in-progress sessions and clears
    `active_program_id`.
  - **Delete** `startOver`, `listCycles` and `loadActiveCycleRow`. `skipToBlock` comes in T062.
- [x] T022 Update `src/features/fitness-tracker/server/training.ts`:
  - **`loadActiveContext`** loads the active program's single cycle.
  - **Session queries** filter by `(cycleId, pass, trainingBlockId = cycle.currentBlockId)`.
  - **`startWorkout`** inserts `pass` and `trainingBlockId`.
  - **`logSet`**:
    - matches the planned set with `plannedSet.trainingBlockId === session.trainingBlockId` (pass block IDs
      to `decideLogSet` instead of numbers, and update `domain/logging.ts` and its tests to match)
    - writes `pass: session.pass`
    - writes `blockNumber` from the block's current position
  - **`finishWorkout`**:
    - uses `decideAfterFinish` over the ordered block IDs
    - returns
      `{ progression: 'none' | 'block-advanced' | 'new-pass', completedBlockNumber }`, where
      `completedBlockNumber` is the finished session's block position
    - writes `current_block_id` for `advance`, or `startPassStatements` for `new-pass`
  - **`getSession`**:
    - returns `block: { id, number, label }`, with `number` and `label` null when the block no longer
      exists
    - loads planned sets by `session.trainingBlockId`
    - no longer fails when the block is gone, but still returns `not-found` when the workout is gone
  - **`getTrainingOverview`** returns the new `TrainingOverview`:
    - one extra query reads finished sessions of `(cycle.id, cycle.pass)` grouped by
      `training_block_id`, feeding `blockStatuses`
    - `workouts` carries `sessionId` and `finishedAt` for the current block
    - `currentBlock.isLast` comes from the block order
- [x] T023 Update the remaining storage tests to the new field names only. Their assertions stay the same
      (FR-044):
  - `training.storage.test.ts`: `session.block`, `progression: 'new-pass'`
  - `history.storage.test.ts`: `context.pass`
  - `atomicity.storage.test.ts`, `isolation.storage.test.ts` (drop the `startOver` and `listCycles`
    cases until T062 adds `skipToBlock`), `harness.storage.test.ts` and `performance.storage.test.ts`
  - `src/features/fitness-tracker/server/history.ts`
- [x] T024 Run `pwsh -NoProfile -File scripts/check.ps1` until it exits `0`. Then grep `src/` for
      `cycleNumber`, `blockNumber` (outside set log context), `startOver`, `listCycles`, `activeCycle`,
      `ended_early` and `CycleStatus`. Expect no hits.

### BFF plumbing

- [x] T025 [P] Create `src/features/fitness-tracker/domain/errors.ts` exporting
      `FitnessErrorCode` as a string-literal union. It contains every refusal code in
      [http-api.md](contracts/http-api.md), plus `'unauthorized' | 'invalid-body' | 'unexpected'`. It
      also exports a type guard `isFitnessErrorCode(value: unknown)`.
- [x] T026 [P] Add `fitnessErrorStrings: Record<FitnessErrorCode, string>` to `src/lib/strings/fitness.ts`.
      The record type makes a missing code a type error (SC-006). Write short, plain sentences, e.g.
      `name-taken`: "That name is already used.", `already-weighed-in-today`: "You've already weighed in
      today.", `program-incomplete`: "Add at least one workout before activating.",
      `set-already-logged`: "That set is already logged. The page has been refreshed.", `unexpected`:
      "Something went wrong. Try again."
- [x] T027 [P] TDD the pure parts of `src/features/fitness-tracker/server/http.ts`, with tests in
      `src/features/fitness-tracker/server/http.test.ts` (`node` project):
  - **`authorize(session: SessionClaims | null)`**: `null` gives a `401` `Response` with
    `{ error: 'unauthorized' }`.
  - **`respond(result)`**:
    - `ok` gives `200` with `Response.json(value ?? {})`
    - `not-found` gives `404`
    - the input codes listed in http-api.md give `400`
    - other codes give `409`
    - every body is `{ error }`
  - **Body readers** `readJson(request)`, `readString(body, key)`, `readNumber(body, key)`,
    `readNullableNumber`, `readBoolean`, `readNumberArray`: return `Result<…, 'invalid-body'>`, and
    reject missing keys and wrong types.
- [x] T028 Implement the edge of `src/features/fitness-tracker/server/http.ts`:
  - **`FitnessRequestContext`** = `{ db, profileId, now, request, params: Record<string, string> }`.
  - **`fitnessRoute(handle)`** returns `(request, { params }) => Promise<Response>`. It calls `getSession`
    and `authorize`, then `getDatabase()`, then `ensureProfile(db, session.sub, now)`. It awaits `params`,
    then calls `handle`. A thrown error gives `500 { error: 'unexpected' }`. Nothing is logged to the
    client.

  No test of its own: it is the thin edge covered by the acceptance test (003).

- [x] T029 [P] TDD `useFitnessAction()` in `src/features/fitness-tracker/components/useFitnessAction.ts`,
      with a test using `renderHook`.
  - **It returns** `{ run(method, url, body?, onSuccess?), pending, errorMessage, clearError }`.
  - **`run`**:
    - sends JSON
    - on `2xx`, calls `onSuccess(json)`, or `router.refresh()` when there's no `onSuccess`
    - on a JSON error body with a known code, sets `errorMessage` to `fitnessErrorStrings[code]`
    - on `set-already-logged` and `session-not-in-progress`, also calls `router.refresh()`
    - on anything else, sets `fitnessErrorStrings.unexpected`
  - **`pending`** is true while a request is in flight. A second `run` while pending is ignored.
- [x] T030 [P] TDD `ConfirmDialog` in `src/features/fitness-tracker/components/ConfirmDialog.tsx` (plus
      `.module.css` and `.test.tsx`; research R13). It is a client component with the props
      `{ triggerLabel, message, confirmLabel, onConfirm, triggerClassName?, disabled? }`.
  - **The trigger button** opens a `<dialog>` with `showModal()`. Stub `HTMLDialogElement.prototype.showModal`
    and `close` in the test, because jsdom lacks them.
  - **The dialog** shows `message`, a confirm button (`confirmLabel`) and Cancel (`fitnessStrings.common.cancel`).
  - **Confirm** calls `onConfirm` and closes. **Cancel** closes without calling it.
- [x] T031 [P] Create the server components `InlineError` (`{ message: string | null }`, which renders
      nothing for null and otherwise `<p role="alert">`) and `BackLink` (`{ href, label }`, a link with
      `styles.back`), in `src/features/fitness-tracker/components/`, with `.module.css` and a small
      `.test.tsx` each.
- [x] T032 [P] Time zone (research R10):
  - **`TimeZoneCookie`** (`src/features/fitness-tracker/components/TimeZoneCookie.tsx`): a client component
    that renders nothing. On mount it reads
    `Intl.DateTimeFormat().resolvedOptions().timeZone`. If `document.cookie`'s `tz` differs, it writes
    `tz=<encoded>; Path=/; Max-Age=31536000; SameSite=Lax` and calls `router.refresh()` once. Test it with
    a jsdom cookie.
  - **`readTimeZone()`** (`src/features/fitness-tracker/server/time-zone.ts`): reads `cookies().get('tz')`,
    validates it with `localDate(new Date(), tz)`, and falls back to `'UTC'`.
  - **Mount** `TimeZoneCookie` in a new `src/app/fitness-tracker/layout.tsx` that renders `{children}`
    after it.
- [x] T033 [P] Create `requireFitnessContext(path)` in
      `src/features/fitness-tracker/server/page-context.ts`. It calls `requireSession(path)`, then
      `getDatabase()`, then `ensureProfile`, and returns `{ db, profileId, now: new Date() }`. Add
      `src/app/fitness-tracker/not-found.tsx`, rendering `fitnessStrings.notFound.title` and a `BackLink`
      to `/fitness-tracker` (spec edge case: unknown or foreign ID).
- [x] T034 [P] Add tokens to `src/app/globals.css`, with dark-mode re-declarations in the existing dark
      block: `--color-surface-muted` (optional slots), `--color-highlight` and `--color-highlight-text`
      (the current block and the suggested workout), `--color-success` (logged sets), `--color-danger`
      (destructive buttons and errors), and `--sticky-bar-height`.
- [x] T035 Run `pwsh -NoProfile -File scripts/check.ps1` until it exits `0`.

**Checkpoint**: the domain matches FR-045 and FR-043, and every handler and page has its plumbing.

---

## Phase 3: User Story 2 — Daily weigh-in (P1)

**Goal**: the home page with the weigh-in row first, the active program card, and links to Programs and
Exercises.

**Independent Test**: open `/fitness-tracker` with no entries, with yesterday's entry and with today's
entry. Weigh in, and check the button state and "Last entry". This is automated in T037 and T039.

- [x] T036 [P] [US2] Write `src/features/fitness-tracker/server/handlers/bodyweight.storage.test.ts`
      for `handleRecordBodyweight`:
  - `200` with `{ id, date, weightKg: 74.2 }`
  - `400 invalid-weight` for `0`
  - `400 invalid-time-zone`
  - `409 already-weighed-in-today` on the second call the same day
  - `400 invalid-body` when `timeZone` is missing
- [x] T037 [P] [US2] Write `src/app/fitness-tracker/FitnessHomeScreen.test.tsx` (US2 scenarios 1–6,
      FR-006–FR-009):
  - the weigh-in row is the first element of `main`
  - `isWeighInAvailable` toggles the disabled state
  - `lastEntryKg: 74.5` renders `lastEntry('74.5')`, and `null` renders no "Last entry"
  - the active program card shows the name, "Block 2 · Deload" and the suggested workout name, and links
    to `/fitness-tracker/active`
  - with `overview: null`, it shows "No active program" and a link to `/fitness-tracker/programs`
  - there are links to Programs and Exercises

  Props: `{ isWeighInAvailable: boolean; lastEntryKg: number | null; overview: TrainingOverview | null }`.

- [x] T038 [P] [US2] Write `src/features/fitness-tracker/components/WeighInRow.test.tsx`:
  - tapping "Weigh in" reveals a textbox with `inputMode="decimal"`, Save and Cancel
  - Cancel hides it without `fetch`
  - Save with `74,2` posts `{ weightKg: 74.2, timeZone }` to `/api/fitness/bodyweight`
  - invalid input shows `fitnessErrorStrings['invalid-weight']` without `fetch`
  - a `409` shows `fitnessErrorStrings['already-weighed-in-today']`
- [x] T039 [US2] Implement `handleRecordBodyweight` in
      `src/features/fitness-tracker/server/handlers/bodyweight.ts`, and
      `src/app/api/fitness/bodyweight/route.ts` (`POST`). T036 must pass.
- [x] T040 [US2] Implement `WeighInRow` (client, using `parseKgInput`, `useFitnessAction` and
      `InlineError`) in `src/features/fitness-tracker/components/WeighInRow.tsx` plus `.module.css`. T038
      must pass.
- [x] T041 [US2] Implement `FitnessHomeScreen` (plus `.module.css`) in
      `src/app/fitness-tracker/FitnessHomeScreen.tsx`. Rewrite `src/app/fitness-tracker/page.tsx`:
      `requireFitnessContext('/fitness-tracker')`, `readTimeZone()`,
      `getWeighInStatus(db, profileId, now, tz)`, the last element of `listBodyweight`, and
      `getTrainingOverview`. Delete `FitnessTrackerScreen.tsx`, `.module.css` and `.test.tsx`, and remove
      `featureStrings.fitnessTracker.placeholder`. T037 must pass.
- [x] T042 [US2] Update `e2e/app-foundation.spec.ts`. Replace the placeholder assertions with: the fitness
      tracker shows the "Weigh in" button and the "Programs" link. Run the whole e2e suite. Only
      `fitness-tracker.spec.ts` may fail, and only from step 1.

**Checkpoint**: the home page works on its own. Weigh-in is complete (US2 done).

---

## Phase 4: User Story 3 — Build a program (P1)

**Goal**: programs list, program edit, workout edit with an inline exercise create, and slot edit with
per-block prescriptions.

**Independent Test**: from an empty profile, create a 4-block program, add a workout and a slot (3 × 10),
quick-fill block 1 to 3 × 12, mark it optional, and read it all back. This is automated in the tests below,
plus acceptance steps 1–3.

### Domain and operations

- [x] T043 [P] [US3] Add a storage test to `programs.storage.test.ts`: `listPrograms` returns `blockCount`
      and `workoutCount` per program (FR-025). Then implement it in
      `src/features/fitness-tracker/server/programs.ts` with two grouped counts. No query per program.
- [x] T044 [P] [US3] TDD the pure prescription helpers in
      `src/features/fitness-tracker/domain/prescription-edit.ts`, with tests in
      `prescription-edit.test.ts` (spec R1, R2, FR-029, FR-030):
  - `quickFill(sets, reps)` gives `number[]` (sets ≥ 1, reps 1–999, else `invalid-target` or
    `prescription-needs-a-set`)
  - `addSet(targets)` repeats the last target
  - `removeLastSet(targets)` refuses below one set
  - `copyFrom(previousTargets)`
  - `removesWeightedSets(current: PlannedSetView[], next: number[])` is true when `next.length` drops
    below a set number whose `lastWeightKg` isn't null
  - `summarize(prescriptions)` gives `"3×12 · 3×10 · 3×8"`, and a block with mixed targets is written
    `"12/10/8"`

### Handlers (http-api.md "Exercises" POST, "Programs and their structure")

- [x] T045 [P] [US3] Write `src/features/fitness-tracker/server/handlers/exercises.storage.test.ts` for
      `handleAddExercise`: `200 Exercise`, `400 name-required`, `409 name-taken` for `"chins "` after
      `"Chins"`.
- [x] T046 [P] [US3] Write `src/features/fitness-tracker/server/handlers/programs.storage.test.ts` for:
  - `handleCreateProgram`: `{ id }`, `invalid-block-count`
  - `handleRenameProgram`
  - `handleDeleteProgram`: `409 program-active` for the active program; `200` otherwise, with its set logs
    kept
  - `handleAddBlock`, `handleLabelBlock` (empty label means `null`) and `handleRemoveBlock`
    (`409 program-needs-a-block`)
  - `handleAddWorkout`: `{ id }`
  - `handleUpdateWorkout`: `{ name }`, or `{ toPosition }` with `invalid-position`
  - `handleRemoveWorkout`
- [x] T047 [P] [US3] Write `src/features/fitness-tracker/server/handlers/slots.storage.test.ts` for:
  - `handleAddSlot`:
    - `{ exerciseId, sets: 3, reps: 10 }` gives 3 planned sets of 10 in **every** block (FR-028)
    - `sets: 0` gives `400 prescription-needs-a-set`
    - `reps: 1000` gives `400 invalid-target`
    - an archived exercise gives `409 exercise-archived`
  - `handleUpdateSlot`: `{ exerciseId }` clears last weights; `{ isOptional }`; `{ toPosition }`
  - `handleRemoveSlot`
  - `handleSetPrescription`:
    - `{ targetReps: [12, 12, 12] }` keeps sets 1–3's last weights (spec R1)
    - `[]` gives `400 prescription-needs-a-set`
- [x] T048 [US3] Implement `src/features/fitness-tracker/server/handlers/exercises.ts`
      (`handleAddExercise`), `handlers/programs.ts` and `handlers/slots.ts`. `handleDeleteProgram` reads
      `listPrograms` and refuses `program-active` before calling `deleteProgram`. `handleAddSlot` expands
      `sets`/`reps` with `quickFill`. Add the route files:
  - `src/app/api/fitness/exercises/route.ts` (POST)
  - `src/app/api/fitness/programs/route.ts` (POST)
  - `src/app/api/fitness/programs/[id]/route.ts` (PATCH, DELETE)
  - `src/app/api/fitness/programs/[id]/blocks/route.ts` (POST)
  - `src/app/api/fitness/programs/[id]/workouts/route.ts` (POST)
  - `src/app/api/fitness/blocks/[id]/route.ts` (PATCH, DELETE)
  - `src/app/api/fitness/workouts/[id]/route.ts` (PATCH, DELETE)
  - `src/app/api/fitness/workouts/[id]/slots/route.ts` (POST)
  - `src/app/api/fitness/slots/[id]/route.ts` (PATCH, DELETE)
  - `src/app/api/fitness/slots/[id]/prescriptions/[blockId]/route.ts` (PUT)

  T045–T047 must pass.

### Screens (screens.md "Programs", "Program edit", "Workout edit", "Slot edit")

- [x] T049 [P] [US3] Write `src/app/fitness-tracker/programs/ProgramsScreen.test.tsx`:
  - rows show the name, `"4 blocks · 3 workouts"` and an "Active" badge only on the active program
  - each row links to `/fitness-tracker/programs/<id>`
  - the empty state shows when there are no programs
  - there is a back link to `/fitness-tracker`
  - `NewProgramForm`: the block count defaults to 4; Create posts `{ name, blockCount }` and pushes to
    `/fitness-tracker/programs/<id>`; `name-required` shows inline
- [x] T050 [P] [US3] Write `src/app/fitness-tracker/programs/[programId]/ProgramEditScreen.test.tsx`:
  - the heading is the program name, with a rename form
  - blocks list "Block 1" and their labels, with an editable label
  - Remove is hidden when only one block is left
  - "Add block" posts
  - the workouts list links to Workout edit, with Move up/down and Rename
  - "Add workout" form, and the empty state when there are no workouts
  - **Remove confirmations**: on the current block of a program with a position, the message says which
    block becomes current, or that the program starts again at block 1 when it was last (FR-034). On a
    workout with a session in progress, it mentions that it will be finished.
  - Delete is offered only when `isActive` is false, and its message says the logged sets are kept
    (FR-033)
  - a back link to Programs
- [x] T051 [P] [US3] Write `src/app/fitness-tracker/programs/[programId]/workouts/[workoutId]/WorkoutEditScreen.test.tsx`:
  - slots in order, with the exercise name, the "Optional" tag and muted class (FR-024), and
    `summarize(…)`
  - Move up/down, and Remove with a confirmation
  - `AddSlotForm`:
    - the picker lists only active exercises (FR-037)
    - choosing "New exercise…" reveals a name field
    - Save stays disabled until an exercise is chosen or named and the sets and reps are valid (FR-028)
    - saving a new exercise posts `/api/fitness/exercises` and then `/api/fitness/workouts/<id>/slots`
    - when there are no exercises, the picker opens on "New exercise…" (spec edge case)
- [x] T052 [P] [US3] Write `src/app/fitness-tracker/programs/[programId]/workouts/[workoutId]/slots/[slotId]/SlotEditScreen.test.tsx`:
  - the exercise is shown, with Replace confirming that last weights will be cleared (FR-031)
  - the optional toggle
  - one section per block with its label
  - each set shows its target input and its last weight, or "—"
  - Add set; Remove last set, hidden at one set
  - Quick fill posts `PUT …/prescriptions/<blockId>`
  - Quick fill confirms only when `removesWeightedSets` is true (FR-030)
  - "Copy from previous block" is absent on block 1
- [x] T053 [US3] Implement `ProgramsScreen` and `NewProgramForm` (client) with `.module.css`, and
      `src/app/fitness-tracker/programs/page.tsx` (`listPrograms`). T049 must pass.
- [x] T054 [US3] Implement `ProgramEditScreen` and its client pieces (`RenameForm`, `BlockRow`,
      `WorkoutRow`, `AddWorkoutForm`, `DeleteProgramButton`) with `.module.css`, and
      `src/app/fitness-tracker/programs/[programId]/page.tsx` (`getProgram`, `notFound()` on
      `not-found`, and `getTrainingOverview` when the program is active, to know whether a workout is in
      progress). Leave a placeholder region for the status area that T079 fills. T050 must pass.
- [x] T055 [US3] Implement `WorkoutEditScreen` and `AddSlotForm` with `.module.css`, and
      `src/app/fitness-tracker/programs/[programId]/workouts/[workoutId]/page.tsx`. It reads `getProgram`
      and `listExercises({ includeArchived: false })`, and calls `notFound()` if the workout isn't in
      that program. T051 must pass.
- [x] T056 [US3] Implement `SlotEditScreen` and `PrescriptionSection` with `.module.css`, and
      `src/app/fitness-tracker/programs/[programId]/workouts/[workoutId]/slots/[slotId]/page.tsx`. T052
      must pass.
- [x] T057 [US3] Run `scripts/check.ps1`. Then run the acceptance test `e2e/fitness-tracker.spec.ts`: it must get through step 3 and now fail at
      step 4 (Activate).

**Checkpoint**: programs can be built entirely from the phone (US3 done).

---

## Phase 5: User Story 4 — Activate, pause and skip to a block (P2)

**Goal**: activation from program edit, the active program view with block statuses, skip to block, and
pause.

**Independent Test**: with two programs, activate one, switch, skip to block 4, skip to block 1, pause, and
reactivate. Check the statuses each time (T058–T060, T065).

- [x] T058 [P] [US4] Add `skipToBlock` tests to `src/features/fitness-tracker/server/cycles.storage.test.ts`.
      They replace spec 002's start-over tests and keep their rule numbers, with FR-040 added:
  - **A later block**: becomes current; the blocks in between show `skipped` in `getTrainingOverview`; the
    first workout is suggested; set logs and last weights are unchanged; returns `{ newPass: false }`
  - **The first block**: a new pass, `{ newPass: true }`, with no workouts finished (rule 8)
  - **An in-progress session** of the current block is closed as finished, in both cases
  - **Refusals**: the current block when it isn't first, an earlier non-first block, and another program's
    block give `invalid-block`; with nothing active, `no-active-program`
  - **Rule 7**: after skipping to the last block, finishing it starts a new pass

  Add `skipToBlock` with a foreign block to `isolation.storage.test.ts`.

- [x] T059 [P] [US4] Write `src/features/fitness-tracker/server/handlers/activation.storage.test.ts` for:
  - `handleActivateProgram`: `200`; `409 program-incomplete` for a program without workouts (US4
    scenario 2); `404`
  - `handlePause`: `200`; `409 no-active-program`
  - `handleSkip`: `{ blockId }` gives `{ newPass }`; `400 invalid-block`; `400 invalid-body`
- [x] T060 [P] [US4] Write `src/app/fitness-tracker/active/ActiveProgramScreen.test.tsx` (FR-010, FR-011,
      US4 scenarios 3–9):
  - the program name, with no cycle number anywhere
  - blocks in order, with label, `"3 / 4 workouts"` and a status badge per `BlockStatus`
  - only the current block is a link (to `/fitness-tracker/active/block`), and it is highlighted
  - `SkipToBlockButton` offers exactly the later blocks plus "Block 1 (start again)" (on the last block,
    only block 1)
  - **The confirmation messages** follow screens.md: a later block names the skipped range; a workout in
    progress appends the open-workout sentence
  - confirming posts `{ blockId }` and pushes to `/fitness-tracker/active/block`
  - Pause confirms, posts `DELETE /api/fitness/active-program` and pushes to `/fitness-tracker`
  - a link to Program edit, and a back link home
- [x] T061 [P] [US4] Write a test for the status area of `ProgramEditScreen` in
      `src/app/fitness-tracker/programs/[programId]/ProgramEditScreen.test.tsx`:
  - an inactive program shows "Activate"
  - when another program is active, Activate opens a confirmation naming it ("{B} will be paused and keep
    its place.")
  - otherwise Activate posts directly
  - an active program shows the "Active" badge, Pause, a link to `/fitness-tracker/active` and the note
    "Changes apply to future workouts."
  - `program-incomplete` shows inline
- [x] T062 [US4] Implement `skipToBlock(db, profileId, { blockId }, now)` in
      `src/features/fitness-tracker/server/activation.ts`, using `decideSkip`:
  - `move` updates `current_block_id` and adds `closeInProgressStatements`
  - `new-pass` uses `startPassStatements`
  - everything goes in one batch

  T058 must pass.

- [x] T063 [US4] Implement `src/features/fitness-tracker/server/handlers/activation.ts`
      (`handleActivateProgram`, `handlePause`, `handleSkip`), and the routes
      `src/app/api/fitness/programs/[id]/activation/route.ts` (POST),
      `src/app/api/fitness/active-program/route.ts` (DELETE) and
      `src/app/api/fitness/active-program/skip/route.ts` (POST). T059 must pass.
- [x] T064 [US4] Implement `ActiveProgramScreen`, `SkipToBlockButton` and `PauseButton` with
      `.module.css`, and `src/app/fitness-tracker/active/page.tsx`. It reads `getTrainingOverview` and
      calls `redirect('/fitness-tracker')` when the overview is null. T060 must pass.
- [x] T065 [US4] Fill the status area of `ProgramEditScreen` (`ActivateButton`, which reads the active
      program's name from `listPrograms` in the page; `PauseButton` reused; the note). T061 must pass.
- [x] T066 [US4] Run `scripts/check.ps1`. The acceptance test `e2e/fitness-tracker.spec.ts` must now get through step 4, and fail at step 5 (the
      block view).

**Checkpoint**: programs can be activated, paused and skipped through (US4 done).

---

## Phase 6: User Story 1 — Log a workout at the gym (P1) 🎯

**Goal**: the current block view and the workout session: prefilled sets, one-tap logging, drafts that
survive, finish and the completion notice.

**Independent Test**: with a program built and activated through the operations (storage fixtures), or
through US3 and US4 on the phone, open the suggested workout, log sets unchanged and changed, and finish.
This is the acceptance test, T084.

- [x] T067 [P] [US1] Write `src/features/fitness-tracker/server/handlers/training.storage.test.ts` for:
  - `handleStartSession`: `{ sessionId }`; the same ID again for an in-progress session (spec edge case);
    `409 workout-already-finished`; `409 workout-not-in-active-program`
  - `handleLogSet`:
    - `{ plannedSetId, reps: 12, weightKg: 67.5 }` gives a `SetLog` with `weightKg 67.5` (US1 scenario 4)
    - `weightKg: null` is allowed
    - the same planned set again gives `409 set-already-logged`, with no second set log (research R9)
    - `400 invalid-reps`
    - `409 session-not-in-progress` after finishing
  - `handleFinishSession`: `{ progression: 'none', completedBlockNumber }`; `'block-advanced'`;
    `'new-pass'`; `409 session-not-in-progress` the second time
- [x] T068 [P] [US1] Write `src/app/fitness-tracker/active/block/CurrentBlockScreen.test.tsx` (FR-013–FR-016,
      FR-023, US1 scenarios 1, 6 and 7):
  - the heading is "Block n · label"
  - workouts in order, with a status, and a date for the finished ones
  - the suggested workout is highlighted
  - a not-started workout is a button that posts `/api/fitness/workouts/<id>/session` and pushes to
    `/fitness-tracker/active/sessions/<sessionId>`
  - an in-progress workout is a link to its session
  - a finished workout is neither
  - **The completion notice**: `completed=2` with `progression` not `none` shows `blockComplete(2)`; when
    the program started again, it shows `programComplete`
  - a back link to `/fitness-tracker/active`
- [x] T069 [P] [US1] Write `src/features/fitness-tracker/components/useSetDrafts.test.ts` (research R12):
      values written for a planned set are read back by a new hook instance with the same session ID;
      `clear(plannedSetId)` and `clearAll()`; a `localStorage` that throws is tolerated (the hook falls
      back to memory).
- [x] T070 [P] [US1] Write `src/app/fitness-tracker/active/sessions/[sessionId]/WorkoutSessionScreen.test.tsx`
      (FR-017–FR-024, US1 scenarios 2–5 and 8):
  - the heading is "Day 1 · Block 2"
  - sections are in slot order, and an optional slot has the muted class and the "Optional" tag
  - **A set that isn't logged**: set number, `"12 reps"`, a weight textbox named `weightLabel(n)` with
    `inputMode="decimal"` prefilled with `formatKg(suggestedWeightKg)` (empty when null), a reps textbox
    with `inputMode="numeric"` prefilled with the target, and a button named `logLabel(n)`
  - **One tap logs** (FR-018): tapping the button posts `{ plannedSetId, reps, weightKg }` exactly as
    prefilled
  - **Changed values are sent**: weight `67,5` is sent as `67.5`, and an empty weight as `null`
  - **A logged set** shows `loggedLabel(n)` and the values as text, with no inputs (FR-019)
  - **Drafts**: a value typed and remounted survives (FR-021)
  - **Finish**:
    - with any set logged, "Finish workout" posts immediately with no dialog (FR-022)
    - with none logged, it confirms first
    - on success it pushes `/fitness-tracker/active/block?completed=<n>` when progression isn't `none`,
      and `/fitness-tracker/active/block` otherwise
  - **A workout with no slots** shows `fitnessStrings.session.nothingToLog`
- [x] T071 [US1] Implement `src/features/fitness-tracker/server/handlers/training.ts`
      (`handleStartSession`; `handleLogSet`, which reads `getSession`, refuses with
      `isPlannedSetLogged`, then calls `logSet`; `handleFinishSession`), and the routes
      `src/app/api/fitness/workouts/[id]/session/route.ts`, `src/app/api/fitness/sessions/[id]/sets/route.ts`
      and `src/app/api/fitness/sessions/[id]/finish/route.ts` (POST). T067 must pass.
- [x] T072 [US1] Implement `CurrentBlockScreen` and `StartWorkoutButton` with `.module.css`, and
      `src/app/fitness-tracker/active/block/page.tsx`. It reads `getTrainingOverview`, redirects home when
      it is null, and passes `completed` from `searchParams`, plus whether the program started again,
      derived from `currentBlock.number === 1` with `completed` present. T068 must pass.
- [x] T073 [US1] Implement `useSetDrafts` in `src/features/fitness-tracker/components/useSetDrafts.ts`.
      T069 must pass.
- [x] T074 [US1] Implement `WorkoutSessionScreen`, `SetRow` and `FinishWorkoutBar` (sticky, respects
      `--safe-area-bottom`) with `.module.css`, and `src/app/fitness-tracker/active/sessions/[sessionId]/page.tsx`.
      It reads `getSession`, calls `notFound()` on `not-found`, and calls
      `redirect('/fitness-tracker/active/block')` when the status is `finished` (FR-023). Clear the drafts
      on finish. T070 must pass.
- [x] T075 [US1] Run `scripts/check.ps1`, then the acceptance test `e2e/fitness-tracker.spec.ts`. It must pass **unmodified**. If it doesn't, fix the
      code, not the test.

**Checkpoint**: the whole training loop works on the phone. The acceptance test is green (US1 done).

---

## Phase 7: User Story 5 — Manage exercises (P2)

**Goal**: the exercise catalog with a filter, archived exercises, rename, archive and delete.

**Independent Test**: add, rename, archive, unarchive and delete exercises, and check which ones the slot
picker offers (T077–T080).

- [x] T076 [P] [US5] Add `getExerciseUsage` storage tests to `exercises.storage.test.ts` (FR-036, FR-041):
  - an exercise in two workouts lists both, with program and workout names
  - `hasSetLogs` is true after a log
  - an unused exercise gives `{ slots: [], hasSetLogs: false }`
  - a foreign ID gives `not-found`

  Add it to `isolation.storage.test.ts`. Then implement it in
  `src/features/fitness-tracker/server/exercises.ts`, using one join for the slots and one `EXISTS` for
  the set logs.

- [x] T077 [P] [US5] Extend `handlers/exercises.storage.test.ts`:
  - `handleUpdateExercise`: `{ name }` (`409 name-taken`); `{ isArchived: true }`; then `false`
  - `handleDeleteExercise`: `200` when unused; `409 exercise-in-use` when used
- [x] T078 [P] [US5] Write `src/app/fitness-tracker/exercises/ExercisesScreen.test.tsx` (FR-035, US5
      scenarios 1, 2 and 4):
  - active exercises alphabetically
  - the filter textbox narrows the list, case-insensitively
  - "Show archived" reveals the archived ones, marked as such
  - the add form, with an inline `name-taken` message
  - the empty state
  - each row links to `/fitness-tracker/exercises/<id>`
- [x] T079 [P] [US5] Write `src/app/fitness-tracker/exercises/[exerciseId]/ExerciseEditScreen.test.tsx`
      (FR-036, US5 scenarios 3 and 5):
  - rename, with an inline error
  - the "Used in" list, with links to `/fitness-tracker/programs/<programId>/workouts/<workoutId>`
  - Archive and Unarchive
  - Delete is shown only when `slots` is empty and `hasSetLogs` is false; it confirms, then pushes to
    `/fitness-tracker/exercises`
- [x] T080 [US5] Implement `handleUpdateExercise` and `handleDeleteExercise` in `handlers/exercises.ts`,
      and `src/app/api/fitness/exercises/[id]/route.ts` (PATCH, DELETE). T077 must pass.
- [x] T081 [US5] Implement `ExercisesScreen` and `ExerciseList` (client: the filter and the toggle) with
      `.module.css`, and `src/app/fitness-tracker/exercises/page.tsx`
      (`listExercises({ includeArchived: true })`). T078 must pass.
- [x] T082 [US5] Implement `ExerciseEditScreen` with `.module.css`, and
      `src/app/fitness-tracker/exercises/[exerciseId]/page.tsx` (`getExerciseUsage`, `notFound()`). T079
      must pass.

**Checkpoint**: all five stories work.

---

## Phase 8: Polish and cross-cutting concerns

- [x] T083 [P] Check every view under `src/app/fitness-tracker/` with the Playwright MCP browser at 375 px in light and dark mode (the
      `test` skill). There should be no horizontal scroll (SC-005), every tap target should be at least
      `--tap-target-min`, Finish workout should stay reachable, and the optional and highlight styles
      should be legible. Fix in the CSS Modules or tokens only.
- [x] T084 Run the whole e2e suite, `pwsh -NoProfile -File scripts/e2e.ps1`. Every test must pass, and
      `e2e/fitness-tracker.spec.ts` must be unchanged since T002 (`git diff` on the file is empty apart
      from formatting).
- [x] T085 [P] Write `docs/architecture/007-cycle-as-container.md`:
  - the cycle as a per-program container with a pass counter (FR-045)
  - blocks by identity (research R3)
  - the three-step migration, and why `set_logs` is untouched (R5)
  - the route wrapper and its status mapping (R2)
  - Server Actions considered and deferred (R1)

  Add the cycle change to the "Consequences" of `docs/architecture/006-domain-persistence.md` as a
  pointer to 007.

- [x] T086 [P] Update `CLAUDE.md` "Project state". Replace "Not built yet: any fitness screen…" with what
      now exists: the screens under `src/app/fitness-tracker/`, the BFF under `src/app/api/fitness/`,
      `src/features/fitness-tracker/components/` and the cycle model. Keep the "not built yet" items that
      remain: progress views and history.
- [x] T087 [P] Move `src/app/ui-spec.md` to `specs/003-fitness-tracker-ui/ui-spec.md`, and update the
      `ui-spec.md` links in `spec.md` (`../../src/app/ui-spec.md` becomes `ui-spec.md`).
- [ ] T088 Validate per quickstart §2 (a migration dry run on a copy of the local database) and §4 (the
      phone walk-through on a real iPhone in standalone mode), including SC-001 (one tap per set),
      SC-002 (≤ 4 taps to the session), SC-003 (weigh-in in ≤ 3 interactions) and SC-008 (≤ 1 s for
      10 × 5).
- [x] T089 Check the Worker size with `npx opennextjs-cloudflare build`, then `npx wrangler deploy --dry-run`.
      Record the compressed size in ADR 007. Read the generated SQL of `0002` and `0004` once more before
      opening the PR.
- [x] T090 Final gate: `pwsh -NoProfile -File scripts/check.ps1` exits `0`. Grep `src/` for comments (`//`,
      `/*` outside string literals and CSS), because that rule is checked by reading.

---

## Dependencies and execution order

### Phases

- **Setup (T001–T003)** first. T003 confirms the acceptance test's intended failure.
- **Foundational (T004–T035)** blocks every story. Inside it:
  - the pure rules (T004–T009) come before the schema (T010–T014)
  - the schema comes before the operations (T015–T024)
  - the BFF plumbing (T025–T034) can run in parallel with the operations once T009 is done
- **US2 (T036–T042)**: after Foundational. It depends on no other story.
- **US3 (T043–T057)**: after Foundational. It depends on no other story.
- **US4 (T058–T066)**: after Foundational. T065 extends US3's `ProgramEditScreen` (T054). Everything else
  in US4 is independent of US3.
- **US1 (T067–T075)**: after Foundational. Its Vitest work is independent, because the fixtures create
  and activate programs through the operations. Its acceptance test (T075) needs US2's home card, US3's
  screens and US4's activation and active program view.
- **US5 (T076–T082)**: after Foundational. It reuses US3's `handleAddExercise` (T048).
- **Polish (T083–T090)**: after every story.

### Inside each story

The tests ([P], written first and failing), then the domain and operations, then the handlers and routes,
then the screens. Each implementation task names the test it must turn green.

## Parallel opportunities

- **Foundational**: T004, T006, T007 and T008 together (different domain files). T025–T027 and T029–T034
  together after T009.
- **US2**: T036, T037 and T038 together.
- **US3**: T043, T044 and T045–T047 together. Then T049–T052 together, while T048 is implemented.
- **US4**: T058–T061 together.
- **US1**: T067–T070 together.
- **US5**: T076–T079 together.
- **Polish**: T083, T085, T086 and T087 together.

### Example: US1

```text
Task: "T067 Write handlers/training.storage.test.ts"
Task: "T068 Write CurrentBlockScreen.test.tsx"
Task: "T069 Write useSetDrafts.test.ts"
Task: "T070 Write WorkoutSessionScreen.test.tsx"
```

Storage tests must not be **run** in parallel. Only one Vitest invocation may run at a time.

## Implementation strategy

1. **Foundation**: Setup, then Foundational. The domain now matches the clarified cycle model, and the
   gate is green. The schema change is the riskiest step, so stop and review the generated SQL here.
2. **First slice (US2)**: the home page and weigh-in. Usable on the phone at once.
3. **Training MVP (US3, US4, US1)**: build, activate and train. Done when the acceptance test passes
   unmodified (T075). This is the minimum worth deploying, because merging to `main` deploys and runs the
   remote migrations.
4. **Catalog (US5)**, then Polish.

Merge only after Phase 8. A partial merge would apply the migrations to the remote database before the
screens that need them exist.

## Notes

- `[P]` means a different file and no dependency on an incomplete task. It never means running two Vitest
  invocations at once.
- Commit after each task or logical group. The `HANDOVER.md` from the previous feature stays untracked.
