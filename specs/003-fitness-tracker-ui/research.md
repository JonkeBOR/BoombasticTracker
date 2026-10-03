# Research: Fitness Tracker UI

Each section records a decision the plan depends on, why it was chosen, and what else was weighed.
Section numbers (R1…) are referenced from [plan.md](plan.md), [data-model.md](data-model.md) and the
contracts.

## R1 — Reads go through Server Components, writes through route handlers

**Decision**: Every page is a thin `async` Server Component. It calls `requireSession`, resolves the
profile, calls the fitness read operations directly, and renders a synchronous screen component. Every
change goes from a small Client Component to a JSON route handler under `/api/fitness/…`, followed by
`router.refresh()` (or `router.push` when the change moves the user to another view).

**Rationale**: This is what [docs/04-react-and-nextjs.md](../../docs/04-react-and-nextjs.md) already
prescribes: Server Components read the data module directly, and Client Components fetch through `/api/*`.
It keeps pages fully server-rendered, so the client bundle carries only the interactive leaves. It also
keeps the BFF boundary of constitution principle II explicit as named endpoints. `router.refresh()` re-runs
the Server Components without losing client state such as typed but unlogged set values.

**Alternatives considered**:

- **Server Actions with `refresh()`** have less boilerplate, because they need no JSON parsing or route
  files. But they would overturn a documented convention, and they make the endpoint surface implicit. That
  is a cross-cutting change to record in `docs/architecture/` deliberately, not inside a feature. It is
  noted as a candidate for later.
- **Client-side data fetching** (SWR or React Query) for reads is a new dependency, and pages would show
  loading states instead of server-rendered content. It is rejected under Simplicity First.

## R2 — One wrapper turns a route handler into an authenticated fitness call

**Decision**: Two server-only modules provide this. `src/features/fitness-tracker/server/http.ts` holds the
pure parts (`respond`, `authorize`, the body readers) and `fitness-route.ts` holds the edge (`fitnessRoute`),
so the pure parts are unit-tested without the Next.js request scope:

- **`fitnessRoute(handle)`**. It reads the session (`getSession`) and returns `401 { error: 'unauthorized' }`
  without one. Otherwise it opens the database (`getDatabase()`), resolves the profile with
  `ensureProfile(db, session.sub, now)`, and calls `handle({ db, profileId, now, request, params })`.
- **`respond(result)`**. It maps an operation's `Result` to a response:
  - `ok` gives `200` with the value.
  - `not-found` gives `404`.
  - Input errors give `400`: `name-required`, `name-too-long`, `invalid-*`, `invalid-body`, `invalid-block`,
    `prescription-needs-a-set` and `invalid-position`.
  - Every other refusal gives `409`. Each refusal body is `{ error: code }`.
- **Small body readers** that narrow `unknown` JSON to the expected shape, or fail with `invalid-body`.

Every `route.ts` is then a few lines: read params and body, call one operation, then `respond`. The `handle`
functions are tested in the `storage` Vitest project against a real local D1, the same way the operations
already are. The session check is a pure function over `SessionClaims | null`, and it is unit-tested in the
`node` project.

**Rationale**: About twenty endpoints share the same session, profile, error and JSON plumbing. Writing that
once keeps each handler at "validate, call, map", as the guideline requires. Taking the session as a value
follows 003's advice that `cookies()` stays in a thin adapter at the edge.

**Alternatives considered**:

- **A validation library** (zod or valibot) would be a new dependency. The bodies are flat objects of two to
  three fields, and the domain already validates values, so it is rejected.
- **One RPC endpoint**, `/api/fitness/[action]`, means fewer files but an untyped switch. It also hides the
  surface from the file tree, so it is rejected.

## R3 — Sessions and the cycle refer to blocks by identity, not position

**Decision**: The cycle stores `current_block_id`. Each workout session stores `training_block_id` instead
of `block_number`. Block status, completion and the suggested workout are computed over block IDs, and
"next block" means the next block by position after the current block's position.

**Rationale**: This is the root cause of the FR-043 problem (spec R7). Today a session belongs to "position
2", so removing a block makes another block inherit its sessions and the cycle silently moves on. With
identity:

- Removing an earlier block leaves `current_block_id` untouched, so the user stays on the same block, as
  FR-043 requires.
- Removing the current block moves `current_block_id` to the block that followed it. That block has no
  sessions in the current pass, because blocks after the current one are never trained, so none of its
  workouts count as finished.
- Sessions of a removed block point at an ID that no longer exists and simply stop counting. Nothing is
  deleted.
- Moving blocks (`moveTrainingBlock`) becomes harmless too.

Set logs already store `training_block_id`, so the history model agrees.

**Alternatives considered**:

- **Renumbering sessions when a block is removed** keeps positions but rewrites history-bearing rows, and it
  still needs a rule for the removed block's sessions. Rejected.
- **Refusing to remove the current block** is simple but contradicts FR-043. Rejected.

## R4 — The cycle as a container (FR-045)

**Decision**: The `cycles` table becomes one row per program:

- **Columns**: `id`, `program_id` (unique), `current_block_id` and `pass`.
- **Removed**: `number`, `status`, `started_at` and `ended_at`.

The row is created in the same batch as the program (`createProgram`), so every program always has its
cycle, and activation never creates one. Which program is active is still `profiles.active_program_id`.

The pass rules:

- **What a pass is**: each workout session records `pass`, and only sessions with the cycle's current `pass`
  count.
- **What starts a new pass**: finishing the last block, skipping to the first block, or removing the
  current block when it is the last.
- **What a new pass does**: increments `pass`, sets `current_block_id` to the first block, and closes the
  program's in-progress sessions as finished.
- **Pausing**: sets `active_program_id` to null, closes the program's in-progress sessions, and leaves the
  cycle as it is.

**Rationale**: This is the user's clarified model. The single row per program removes the "one active cycle"
partial index, the cycle number sequence, every end-of-cycle status, and `listCycles`.

**Alternatives considered**: The user rejected deleting sessions on a new pass, and detaching them, in
clarification. A pass counter was their choice.

## R5 — Migrating existing data in three steps

**Decision**: The schema change is three migration files, so that no generated SQL is hand-edited (006):

1. **`0002` (generated, additive)**:
   - Adds `cycles.current_block_id` and `cycles.pass`, both nullable.
   - Adds `workout_sessions.training_block_id` and `workout_sessions.pass`, both nullable.
2. **`0003` (custom, via `drizzle-kit generate --custom`)**: moves the data.
   - **Collapse the cycles.** For each program, keep one cycle: the `active` one if any, otherwise the
     highest `number`. Set `pass = number` on it.
   - **Backfill the sessions.** Repoint every session of the program to the kept cycle. Set
     `pass = cycle_number`, and set `training_block_id` from the program's block at `block_number`.
   - **Set the current block.** Set the kept cycle's `current_block_id` from its `current_block_number`.
     If that position no longer exists, use the last block.
   - **Fix up the remaining cases.** Delete the other cycles. Insert a cycle (`pass 1`, first block) for
     any program that has none.
3. **`0004` (generated)**:
   - Makes the new columns `NOT NULL` (drizzle rebuilds the tables).
   - Drops `cycles.number`, `status`, `started_at`, `ended_at` and `current_block_number`, and
     `workout_sessions.block_number` and `cycle_number`.
   - Replaces the indexes with `cycles(program_id)` unique and
     `workout_sessions(cycle_id, pass, training_block_id, workout_id)` unique.

`set_logs` is **not** touched. Its `cycle_number` column keeps its name in SQL and is read as `pass` in
TypeScript (`pass: integer('cycle_number')`). That is right, because old set logs' cycle numbers _are_ the
pass counter: a kept cycle's `pass` continues from the program's highest cycle number.

**Rationale**: SQLite can't make a column `NOT NULL` or drop an indexed column in place, so drizzle
generates a table rebuild for step 3. Doing the data work between two generated steps keeps 006's rule that
generated SQL is never hand-edited. Leaving `set_logs` alone avoids rebuilding a table guarded by the
immutability triggers. A rebuild would have to drop and recreate them, and that is exactly the kind of
change the triggers exist to prevent.

The deploy workflow applies all three in order before the new Worker goes live (005). A session whose
program is gone has no block to point at. Step 2 therefore sets its `training_block_id` to
`'removed-' || block_number`, which keeps the unique index satisfied when step 3 makes the column
`NOT NULL`. Such sessions belong to deleted programs, so nothing ever reads them.

**Alternatives considered**:

- **Renaming `number` to `pass` in one step** would need drizzle-kit's interactive rename prompt, which the
  workflow can't answer. Rejected.
- **Dropping and recreating the fitness tables** would lose the deployed data. Rejected.

## R6 — Skipping to a block is one operation

**Decision**: `skipToBlock(db, profileId, { blockId }, now)` replaces `startOver`.

- **The program's first block** starts a new pass (R4).
- **A block after the current one** sets `current_block_id`, and closes the in-progress session of the
  current pass, if there is one.
- **Anything else** returns `invalid-block`, and so does any block that isn't in the active program.
- **No active program** returns `no-active-program`.

A new pure rule, `decideSkip`, holds the decision, beside `decideAfterFinish` in `domain/progression.ts`.

**Rationale**: This is FR-040 as clarified. Taking a block ID rather than a number matches R3.

## R7 — Editing a program re-evaluates its cycle whether or not it is active

**Decision**: `removeWorkout` and `removeTrainingBlock` re-evaluate the **program's** cycle, which every
program has (R4), not only an active one.

- `reevaluateAfterEdit` becomes a function of the block order, the current block ID, the removed block ID
  if any, the remaining workouts, and the workouts finished in the current block in the current pass.
- `removeWorkout` also closes that workout's in-progress session in the same batch (FR-042).

**Rationale**: A paused program keeps its position (FR-045), so its position must stay valid after edits.
That is the spec's "editing a paused program" edge case.

## R8 — The new read operations (FR-041)

**Decision**: Extend or add only what the screens read.

- **`getTrainingOverview`** returns:
  - the program
  - the current block with its label
  - every block in order, each with `status` (`complete`, `current`, `upcoming` or `skipped`) and
    `finishedCount`
  - `workoutCount`
  - the current block's workouts with their status and session ID
  - `suggestedWorkoutId`

  The block statuses come from one query over the current pass's finished sessions, grouped by block, and
  a pure `blockStatuses` rule.

- **`listPrograms`** adds `blockCount` and `workoutCount` (two grouped counts).
- **`getExerciseUsage`** is new. It returns the slots using an exercise, with program and workout names, and
  whether any set log refers to it. Exercise edit offers Delete only when both are empty. `deleteExercise`'s
  `exercise-in-use` refusal still guards the write.
- **`Program`** (from `getProgram`) replaces `activeCycle` with `cycle: { currentBlockId, pass }`. Program
  edit needs that to word the confirmations for removing the current block or a workout (FR-034).

**Rationale**: Each addition has exactly one screen as its consumer. Nothing new is stored.

## R9 — Not logging a planned set twice is a pure check at the edge

**Decision**: The log-set handler first reads the session (`getSession`). It refuses with `409 set-already-logged`
when the planned set already has a set log in that session, using a pure `isPlannedSetLogged(session,
plannedSetId)` beside the logging rules. Otherwise it calls `logSet`. `logSet` itself is unchanged, so the
domain still allows a second log, as decided in spec R3.

**Rationale**: The check is one comparison, it is unit-testable, and it keeps the domain contract. A race
between two devices within milliseconds could still write two logs. That is acceptable for one user (006
already accepts the same class of race).

## R10 — The time zone travels in a cookie

**Decision**: A tiny client component in the fitness layout writes a `tz` cookie with
`Intl.DateTimeFormat().resolvedOptions().timeZone` (`SameSite=Lax`, `Path=/`, one-year max age, not
`HttpOnly`, not sensitive). It calls `router.refresh()` once if the cookie was missing or different. The
home page reads it with `cookies()` to compute weigh-in availability. A missing or invalid cookie falls back
to `UTC` until the refresh. The weigh-in request sends the time zone in its body too, so the write never
depends on the cookie.

**Rationale**: Server Components can't see the device's time zone, and "today" must follow the device
(spec edge case). A cookie needs no schema change and no client-side fetching of the home page.

**Alternatives considered**:

- **Storing the time zone on the profile** is a schema change for a value the device already knows, and
  it goes stale when travelling. Rejected.
- **Fetching weigh-in status from the client** means a loading flash on the first element of the home page.
  Rejected.

## R11 — Weights are typed as text and parsed exactly

**Decision**: Weight inputs are `<input type="text" inputMode="decimal">`.

- **`parseKgInput`** (a pure function in `domain/values.ts`) accepts `.` or `,` as the decimal separator,
  because iOS shows `,` on the decimal keypad in many regions. An empty input means no weight. Anything
  else must be a positive number with at most two decimals, checked on the string before conversion.
  Conversion goes through the existing `parseWeightKg`, so 61.25 kg becomes exactly 61,250 g.
- **`formatKg`** renders without trailing zeros (62.5, 60, 61.25).
- **Reps** use `inputMode="numeric"`, with whole numbers from 1 to 999.

**Rationale**: FR-009 and FR-039 ask for a decimal keypad and two decimals at most. `type="number"`
rejects `,` in some locales and reformats values, so it is not used.

## R12 — Typed set values survive leaving the session

**Decision**: A client hook keeps unlogged weight and reps per planned set in `localStorage`, under
`fitness:session:<sessionId>`. Every read and write is wrapped in `try/catch`, because storage can be
unavailable. An entry is removed when its set is logged, and the whole key is removed when the session is
finished or found finished.

**Rationale**: FR-021 asks for this. `sessionStorage` doesn't survive the PWA being swiped away on iOS.
Nothing unlogged goes to the server, as the spec's assumptions state.

## R13 — Confirmations use the native `<dialog>`

**Decision**: One `ConfirmDialog` client component built on `<dialog>` and `showModal()`. It has a message,
a confirm button with an action-specific label, and Cancel. It is used by every action in FR-038.

**Rationale**: It needs no dependency, it's accessible by default (focus trap, Escape), it renders in
standalone mode, and it's easy to drive in Playwright. `window.confirm` blocks the thread, can't be styled,
and shows the page's origin as its title in a Home Screen app.

## R14 — Routes

**Decision**: These page routes, all under `src/app/fitness-tracker/`. Each page is a thin `page.tsx` beside
its `…Screen.tsx`, as the existing pages do.

| View            | Route                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| Home            | `/fitness-tracker`                                                          |
| Active program  | `/fitness-tracker/active`                                                   |
| Current block   | `/fitness-tracker/active/block`                                             |
| Workout session | `/fitness-tracker/active/sessions/[sessionId]`                              |
| Programs        | `/fitness-tracker/programs`                                                 |
| Program edit    | `/fitness-tracker/programs/[programId]`                                     |
| Workout edit    | `/fitness-tracker/programs/[programId]/workouts/[workoutId]`                |
| Slot edit       | `/fitness-tracker/programs/[programId]/workouts/[workoutId]/slots/[slotId]` |
| Exercises       | `/fitness-tracker/exercises`                                                |
| Exercise edit   | `/fitness-tracker/exercises/[exerciseId]`                                   |

Some behaviour follows from the routes:

- **The current block has no number in its address**, because only the current block opens (FR-012). An
  old link therefore always shows where the user is now.
- **Starting a workout is a `POST` from a button**, not a page load. The page then navigates to the session.
  If opening the session page created the session, a link prefetch or a reload could start a workout by
  accident.
- **After finishing**, the client navigates to `/fitness-tracker/active/block?completed=<blockNumber>`.
  When the finish advanced the program, the current block view shows "Block 2 complete" above the next
  block, or "Program complete, starting again at block 1". That view _is_ the next block, so it fulfils
  FR-015's link to the next block. It saves the user a tap.
- **A finished session's address** redirects to the current block (FR-023).
- **An unknown or foreign ID** calls `notFound()`, which gives the spec's not-found page with a link home.

## R15 — Text, errors and styling

**Decision**:

- **Text**: `src/lib/strings/fitness.ts` holds all fitness text, grouped by view. It includes
  `fitnessErrorStrings`, typed as `Record<FitnessErrorCode, string>`, so a refusal code without text fails
  typechecking (SC-006).
- **Styling**: CSS Modules beside each screen, using the existing tokens. These additions to `globals.css`
  are needed:
  - a muted surface for optional slots
  - a highlight for the current block and the suggested workout
  - a success colour for logged sets
  - each with its dark-mode re-declaration
- **Layout**: on the session screen, "Finish workout" is a sticky footer that respects
  `--safe-area-bottom`.

**Rationale**: These are the existing conventions (05). The exhaustive error map is what makes "no raw
error code on screen" checkable by the compiler.

## R16 — The acceptance test

**Decision**: `e2e/fitness-tracker.spec.ts` is written first and stays red until the feature is done. It runs
as the e2e owner on an iPhone viewport. In order:

1. Create a uniquely named exercise inline while adding a slot, in a uniquely named one-block program with
   one workout.
2. Activate the program.
3. Open the active program, then the current block, and start the workout.
4. Log set 1 with one tap after typing a weight, and check that it shows as logged.
5. Finish the workout.
6. Expect "Program complete, starting again at block 1". With one block, this is the pass rollover.
7. Start the workout again, and expect the set prefilled with the weight logged before. That is the reason
   the tracker exists.

The existing placeholder assertions in `e2e/app-foundation.spec.ts` are updated, because the placeholder
goes away. Weigh-in is left out, because the local database keeps the e2e owner's weigh-in for the rest of
the day, so a second run would fail. It is covered by Vitest instead.

**Rationale**: Constitution 2.1.0 requires one phone-level acceptance test per feature. Unique names make the
test re-runnable against the persistent local D1 that `next dev` uses.

## R17 — Performance

**Decision**: Nothing special. `getSession` is already under 1 s for 10×10×10×10 (SC-005 of 002), and the
session view adds no queries. `getTrainingOverview` adds one grouped query. SC-008 is checked once by hand
in quickstart §4.

**Rationale**: There is one user and small row counts. Measuring before optimising follows Simplicity First.
