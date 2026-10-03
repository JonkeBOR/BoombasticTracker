# Contract: Screens

Each view: its route (research R14), what the thin `page.tsx` reads, the synchronous screen component it
renders, and the actions it offers (each an endpoint in [http-api.md](http-api.md)). Every page starts with
`requireSession(path)` and resolves the profile with `ensureProfile`. Each screen is a synchronous component
rendered under Testing Library in the `dom` Vitest project. Interactive pieces are small Client Components
inside it.

## Home — `/fitness-tracker`

- **Reads**:
  - `getWeighInStatus(db, profileId, now, tz cookie)`
  - `listBodyweight` (the last entry only)
  - `getTrainingOverview`
- **Renders `FitnessHomeScreen`**:
  1. **`WeighInRow`** (client): the "Weigh in" button, disabled unless available, and "Last entry: X kg".
     Tapping it reveals a decimal input with Save and Cancel. Save sends `POST bodyweight` with the
     device's time zone, then refreshes.
  2. **The active program card**: name, "Block n · label", and the suggested workout. It links to
     `/fitness-tracker/active`. Without an active program it shows "No active program" and links to
     Programs.
  3. **Links** to Programs and Exercises.
- **Covers**: FR-006–FR-009, US2.

## Active program — `/fitness-tracker/active`

- **Reads**: `getTrainingOverview`. It redirects home when there's nothing active.
- **Renders `ActiveProgramScreen`**:
  - the program name
  - the block list: number, label, "3 / 4 workouts", and a status badge. The current block is highlighted
    and links to `/fitness-tracker/active/block`. Other blocks don't link.
  - **`SkipToBlockButton`** (client): a picker of the later blocks plus "Block 1 (start again)", then a
    `ConfirmDialog`:
    - **Later block**: "Skip to block 4? Blocks 2–3 will be marked as skipped. Your logged sets are kept."
    - **Block 1**: "Start the program again from block 1? Your logged sets are kept."
    - **With a workout in progress**, both add "Your open workout will be finished."

    Afterwards it navigates to the block view.

  - **`PauseButton`** (client) with confirmation. Afterwards it navigates home.
  - a link to Program edit
- **Covers**: FR-010–FR-012, FR-040, US4.

## Current block — `/fitness-tracker/active/block`

- **Reads**: `getTrainingOverview`, and the optional `completed` search param.
- **Renders `CurrentBlockScreen`**:
  - **The completion notice, when `completed` is present**: "Block {completed} complete". When the program
    started again, it reads "Program complete, starting again at block 1".
  - the block heading
  - the workouts in order, with status. The finished ones show their date.
  - the suggested workout, highlighted
- **Taps**:
  - **A not-started workout** is a `StartWorkoutButton` (client). It calls `POST workouts/[id]/session`,
    then pushes to the session.
  - **An in-progress workout** links to its session.
  - **A finished workout** isn't interactive (FR-023).
- **Covers**: FR-013–FR-016, US1.

## Workout session — `/fitness-tracker/active/sessions/[sessionId]`

- **Reads**: `getSession`. `not-found` gives `notFound()`, and a finished session redirects to
  `/fitness-tracker/active/block`.
- **Renders `WorkoutSessionScreen`**:
  - "Day 1 · Block 2"
  - one section per slot. An optional slot is muted and tagged "Optional".
  - **`SetRow`** (client) per planned set:
    - **Not logged yet**: set number, "12 reps", a weight input (decimal keypad, prefilled from
      `suggestedWeightKg`), a reps input (prefilled from the target), and a ✓ button. Typed values are
      kept by the drafts hook (research R12).
    - **Logged**: the logged values as text with a check mark, and no inputs.
  - **`FinishWorkoutBar`** (client, sticky): finishes at once when a set is logged. Otherwise it confirms
    "Finish without logging any sets?". Afterwards it navigates as described in http-api.md.
- **Covers**: FR-017–FR-024, US1.

## Programs — `/fitness-tracker/programs`

- **Reads**: `listPrograms`.
- **Renders `ProgramsScreen`**: rows with name, "4 blocks · 3 workouts" and an "Active" badge, or the empty
  state "No programs yet. Create one to start training."
- **`NewProgramForm`** (client): a name, and a block count (default 4). It posts, then pushes to the new
  program's edit page.
- **Covers**: FR-025, US3.

## Program edit — `/fitness-tracker/programs/[programId]`

- **Reads**: `getProgram`. `not-found` gives `notFound()`.
- **Renders `ProgramEditScreen`**:
  - **The name**: an inline rename form.
  - **The status area**:
    - **Inactive**: "Activate". When another program is active, it confirms "{B} will be paused and keep
      its place."
    - **Active**: an "Active" badge, Pause, and a link to the active program. It also shows the note
      "Changes apply to future workouts."
  - **The blocks**: number, an editable label, and Remove with a confirmation. Removing the current block
    of a program that has a position says what happens next (FR-034). "Add block" sits at the end, and
    Remove is hidden while only one block is left.
  - **The workouts**: name (links to Workout edit), Rename, Move up/down, and Remove with a confirmation.
    The confirmation mentions an open workout and what happens to the current block. "Add workout" is a
    name form. With no workouts there is an empty state.
  - **Delete program**: shown only while the program is inactive, with a confirmation (FR-033).
- **Covers**: FR-026, FR-032–FR-034, US3, US4.

## Workout edit — `/fitness-tracker/programs/[programId]/workouts/[workoutId]`

- **Reads**: `getProgram` and `listExercises({ includeArchived: false })`. A workout that isn't in the
  program gives `notFound()`.
- **Renders `WorkoutEditScreen`**:
  - the name (rename)
  - the slots: exercise name, an "Optional" tag, and the summary "3×12 · 3×10 · 3×8"; Move up/down; and
    Remove with a confirmation. Each slot links to Slot edit.
  - **`AddSlotForm`** (client): an exercise picker of active exercises, with a "New exercise…" choice that
    reveals a name field, plus sets and reps. Save stays disabled until an exercise is chosen or named and
    both numbers are valid. A new exercise is posted first and then the slot. When the slot fails, the
    exercise remains and is chosen.
- **Covers**: FR-024, FR-027, FR-028, FR-037, US3.

## Slot edit — `/fitness-tracker/programs/[programId]/workouts/[workoutId]/slots/[slotId]`

- **Reads**: `getProgram` and `listExercises({ includeArchived: false })`.
- **Renders `SlotEditScreen`**:
  - **The exercise**, with "Replace" opening a picker. It confirms "Last weights for this exercise in this
    workout will be cleared."
  - **An optional toggle.**
  - **One section per block**, headed by number and label. Each section lists its sets: set number, a reps
    input saved on change, and the last weight read-only or "—".
  - **Section actions**: Add set, Remove last set (hidden when only one set is left), Quick fill (sets × reps)
    and Copy from previous block (from block 2 on). Quick fill and copy confirm only when they would
    remove sets that have a last weight (FR-030).
- **Covers**: FR-029–FR-031, US3.

## Exercises — `/fitness-tracker/exercises`

- **Reads**: `listExercises({ includeArchived: true })`. The filter and the "Show archived" toggle are
  client-side over that list.
- **Renders `ExercisesScreen`**: alphabetical rows, an add form (an inline `name-taken` message), and the
  empty state.
- **Covers**: FR-035, US5.

## Exercise edit — `/fitness-tracker/exercises/[exerciseId]`

- **Reads**: `getExerciseUsage`.
- **Renders `ExerciseEditScreen`**:
  - rename, with the inline `name-taken` message
  - the "Used in" list of program and workout, linking to Workout edit
  - Archive or Unarchive
  - Delete, only when `slots` is empty and `hasSetLogs` is false, with a confirmation
- **Covers**: FR-036, US5.

## Shared pieces (`src/features/fitness-tracker/components/`)

| Component          | Kind   | Purpose                                                                                                   |
| ------------------ | ------ | --------------------------------------------------------------------------------------------------------- |
| `ConfirmDialog`    | client | `<dialog>`-based confirmation (research R13)                                                              |
| `useFitnessAction` | hook   | Sends a JSON request, maps the error code to `fitnessErrorStrings`, and refreshes or navigates on success |
| `InlineError`      | server | Renders a refusal message with `role="alert"`                                                             |
| `BackLink`         | server | The back link to the parent view (FR-003)                                                                 |
| `TimeZoneCookie`   | client | Keeps the `tz` cookie current (research R10). Mounted in `src/app/fitness-tracker/layout.tsx`             |
