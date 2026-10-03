# Fitness Tracker — UI Spec

## Purpose

This spec describes the views and user flows of the fitness tracker. It builds on the implemented domain described in `domain-spec.md`: all terms (program, training block, cycle, workout session, planned set, set log, last weight…) and all numbered rules referenced below (e.g. _rule 14_) come from that document. This spec doesn't redefine domain behaviour. It describes how the user sees and triggers it.

## Implementation notes that affect the UI

The domain is implemented. Where the implementation differs from `domain-spec.md`, the implementation wins:

- **Target is reps only:** a whole number from 1 to 999. There are no time-based targets and no rep ranges, so the UI has no target-type choice.
- **Weights are kg in the UI and grams in storage.** The UI accepts and shows kg with up to two decimals (e.g. 61.25), and converts exactly.
- **The profile is found automatically** from the signed-in Google account (one profile per account). The UI never asks the user to create or choose a profile.
- **One session per workout per block per cycle.** Opening a workout that already has an in-progress session resumes it. It never creates a second one.
- **Deleting a program** deletes its plan and its cycles, but keeps its sessions and set logs (for future progress views).

## Domain changes required

This spec needs these additions to the implemented domain. They extend `domain-spec.md` and use its rule numbers where they relate.

- **D1 — Jump to a block (new).** In the active cycle, the user can move the current block forward to any later block, e.g. from block 2 straight to block 4.
  - The suggested next workout becomes the first workout of the chosen block (rule 10).
  - Any in-progress session in the block being left is closed as finished.
  - The blocks passed over stay as they are. No sessions or set logs are created, changed or removed.
  - Last weights are untouched, so the chosen block prefills as usual (rule 14).
  - Finishing the last block still completes the cycle (rule 7), even if earlier blocks were skipped.
- **D2 — Jumping to block 1 is "start over"** (rule 8): the cycle ends early and a new cycle starts at block 1. It can't stay in the same cycle, because block 1 already has sessions in this cycle (one session per workout per block per cycle). Nothing is lost either way.
- **D3 — Skipped block (derived state).** A block before the current block in the active cycle, or before the reached block in a cycle that ended early, that isn't complete is **skipped**. It's derived from sessions, not stored.
- **D4 — Removing the current block** while the program has an active cycle moves the current block to the next block. If it was the last block, the cycle is completed and a new cycle starts at block 1 (rule 7). Removing any other block doesn't change the current block.
- **D5 — Removing a workout** while the program has an active cycle: any in-progress session for it is closed as finished, and block completion is re-evaluated. If every remaining workout in the current block is finished, the cycle moves to the next block as in rule 7. Otherwise the suggested next workout is the next unfinished one.
- **D6 — Every block prescription has at least one planned set** (as `domain-spec.md` already states). Adding a slot must create planned sets for every block in the same operation. Removing the last planned set of a block is refused. Adding a block creates planned sets for every slot by copying the previous block's set count and target reps, with empty last weights (rule 19).

## Context

- The fitness tracker is one feature of a larger personal app. It's reached from the app's landing page and lives under its own route segment (e.g. `/fitness-tracker`).
- **Single user:** one profile per login. There is no profile list or profile switching; the profile exists implicitly for the signed-in user.
- **Mobile first:** the primary device is an iPhone, with the app added to the home screen (standalone PWA). Every view must work one-handed at phone width. Desktop is supported but secondary.
- **Gym use:** the workout session view is used between sets, often in a hurry. It's the most important view to get right: large touch targets, minimal typing, no unnecessary confirmation dialogs.

## View map

```
Fitness tracker home (profile page)
├── Active program
│   └── Cycle
│       └── Training block
│           └── Workout session
├── Programs
│   └── Program edit
│       ├── Cycle history (→ Cycle → Block → Session, read-only)
│       └── Workout edit
│           └── Exercise slot edit
└── Exercises
    └── Exercise edit
```

Navigation is drill-down: each view links to its children, and every view below the home page has a back link to its parent. Suggested routes are listed per view; final route naming is decided during planning.

---

## User stories

### US1 — Log a workout (P1)

As the user, at the gym, I open my active program, drill down to today's workout, and log each set with the weight already filled in from last time, so logging takes a tap per set.

**Acceptance scenarios**

1. Given an active program in cycle 2, block 1, when I open the active program, then I see cycle 2 marked as active, and drilling into it shows block 1 as current with the next workout highlighted.
2. Given a workout where incline bench press logged 65 / 62 / 60 kg in block 1 of the previous cycle, when I open that workout in block 1 of this cycle, then sets 1–3 show 65, 62 and 60 kg prefilled.
3. Given a prefilled set, when I tap its log button without changing anything, then a set log is created with the prefilled weight and target reps, and the set is shown as logged.
4. Given a prefilled set, when I change the weight to 67.5 and log it, then the set log records 67.5 kg.
5. Given an exercise with no history, when I open the workout, then its sets show target reps and an empty weight field.
6. Given I've logged some sets, when I tap "Finish workout", then the session is finished and I return to the block view, with the workout marked finished.
7. Given the workout I finish is the last unfinished workout in the block, when I finish it, then the block view shows the block as complete and offers a link to the next block (or the new cycle).

### US2 — Daily weigh-in (P1)

As the user, the first thing I see when opening the fitness tracker is the option to record today's bodyweight.

**Acceptance scenarios**

1. Given no bodyweight entry today and a previous entry of 74.5 kg, when I open the fitness tracker, then the top of the page shows an enabled "Weigh in" button next to "Last entry: 74.5 kg".
2. Given I tap "Weigh in", enter 74.2 and save, then the entry is stored, the text reads "Last entry: 74.2 kg", and the button is disabled.
3. Given I've already recorded bodyweight today, when I open the fitness tracker, then the button is disabled.
4. Given no bodyweight entries at all, then the button is enabled and no "Last entry" text is shown.
5. Ignoring the weigh-in has no effect on anything else.

### US3 — Build a program (P1)

As the user, I create a program with training blocks and workouts, and for each exercise I define the sets and reps per block.

**Acceptance scenarios**

1. Given the program list, when I create a program named "Strength" with 4 blocks, then I land on its edit page showing blocks 1–4 and no workouts.
2. Given a program, when I add the workout "Day 1", then it appears in the workout list and I can open it.
3. Given a workout, when I add incline bench press, then I must enter its sets × reps (e.g. 3 × 10) before the slot can be saved, and the slot is created with those planned sets in every block.
4. Given a slot, when I set block 1 to 3 × 12 reps using the quick fill, then block 1's planned sets are replaced by three sets of 12 reps.
5. Given a block with one planned set left, then removing that set isn't possible.
6. Given a slot, when I mark it optional, then it's shown with the optional style everywhere it appears.

### US4 — Activate, pause, skip ahead, and start over (P2)

As the user, I choose which program is active, pause it, skip ahead to a later block, or start over from block 1 after a break.

**Acceptance scenarios**

1. Given program B is active, when I activate program A, then I'm asked to confirm that B will be paused and its cycle ended. On confirm, A becomes active and starts a new cycle at block 1.
2. Given a cycle with 4 blocks and I'm on block 2, when I choose "Change block", then I can pick block 3, block 4, or block 1 (start over).
3. Given I pick block 4 and confirm, then block 4 becomes current, its first workout is suggested, block 2 and 3 are shown as skipped, and all logged sets remain.
4. Given I've jumped to block 4, when I open its first workout, then the sets are prefilled with their last weights as usual.
5. Given I pick block 1 (start over) and confirm, then the current cycle is shown as ended early at block 2, and a new cycle starts at block 1.
6. Given the active program, when I pause it, then the home page shows no active program and links to the program list.

### US5 — Manage exercises (P2)

As the user, I keep a catalog of exercises to pick from when building workouts.

**Acceptance scenarios**

1. Given the exercise list, when I add "Seal rows", then it appears in the list and can be chosen in a slot.
2. Given an exercise named "Chins" exists, when I try to add another "Chins", then I see an error that the name is taken.
3. Given an exercise with set logs, when I open its edit page, then I can archive it but not delete it.

### US6 — Browse history (P3)

As the user, I can look back at past cycles, blocks and sessions to see what I logged.

**Acceptance scenarios**

1. Given a completed cycle, when I open it, then all its blocks are shown as complete, and each finished session shows its logged sets.
2. Given a cycle that ended early, when I open it, then blocks after the one it reached are shown as not reached.
3. Given a cycle where blocks were skipped, when I open it, then those blocks are shown as skipped, with any workouts finished before the jump still listed.

---

## Views

### 1. Fitness tracker home (profile page)

**Route:** `/fitness-tracker`

**Shows, top to bottom:**

1. **Weigh-in row.** Just two things, side by side:
   - A **Weigh in** button. It's enabled only if there's no entry today (rule 22). Tapping it shows a numeric input (kg, decimal keypad) and Save. Cancelling closes it without saving.
   - The text **"Last entry: 74.5 kg"**, showing only the weight of the most recent entry. It's hidden if there are no entries.
   - No date, no history list.
2. **Active program card.**
   - With an active program: program name, cycle number, current block (number and label), and the next suggested workout. The card links to the Active program view.
   - Without one: "No active program" and a link to Programs.
3. **Navigation:** links to Programs and Exercises.

### 2. Active program

**Route:** `/fitness-tracker/active` (resolves to the active program; if there is none, redirects home)

**Shows:**

- Program name.
- List of cycles, newest first. Each row: cycle number, status (active / completed / ended early), start date, end date, and for ended-early cycles the block reached. The active cycle is visually highlighted and listed first.
- Tapping a cycle opens the Cycle view.

**Actions:**

- **Change block** (D1, D2): opens a picker listing every block after the current one, plus **Block 1 (start over)**. Earlier blocks other than block 1 aren't offered. Requires confirmation:
  - Later block: "Skip to block 4? Blocks 2–3 will be marked as skipped. Your logged sets are kept."
  - Block 1: "Start over? Cycle 3 ends at block 2 and cycle 4 starts at block 1. Your logged sets are kept."
  - After confirming, the user lands on the Training block view of the chosen block, with its first workout highlighted.
- **Pause program** (rule 2): requires confirmation.
- Link to Program edit.

### 3. Cycle

**Route:** `…/cycles/[cycleNumber]`

**Shows:**

- Cycle number, status, dates.
- List of training blocks in order. Each row: block number, label (e.g. "Deload"), and status:
  - **Complete:** all workouts finished in this cycle.
  - **Current:** the active cycle's current block, visually highlighted.
  - **Upcoming:** later blocks in the active cycle.
  - **Skipped:** earlier blocks that weren't completed because the user jumped past them (D3).
  - **Not reached:** blocks after the reached block in an ended-early cycle.
- Each row shows progress, e.g. "3 / 4 workouts".
- Tapping a block opens the Training block view. Skipped blocks open read-only, showing any workouts finished before the jump. Upcoming and not-reached blocks are shown but not tappable, or open a read-only view with the planned prescriptions (implementer's choice).
- For the active cycle, a **Change block** action (same as in view 2).

### 4. Training block

**Route:** `…/cycles/[cycleNumber]/blocks/[blockNumber]`

**Shows:**

- Cycle and block number, block label.
- List of workouts in program order. Each row: workout name and status:
  - **Finished**, with the finish date.
  - **In progress**.
  - **Not started**.
- The suggested next workout (rule 10) is visually highlighted.

**Behaviour:**

- In the **current block of the active cycle**, tapping a not-started workout starts a session and opens the Workout session view. Tapping an in-progress workout resumes it. Any not-started workout can be started, not only the suggested one.
- In any other block, tapping a finished workout opens its session read-only. Not-started workouts aren't tappable.
- When the block is complete (e.g. right after finishing its last workout), the view shows a "Block complete" message with a link to the next block, or to the new cycle if this was the last block (rule 7).

### 5. Workout session

**Route:** `…/blocks/[blockNumber]/workouts/[workoutId]`

The most-used view. Designed for speed at the gym.

**Shows:**

- Workout name, cycle and block (e.g. "Day 1 · Cycle 2 · Block 1").
- Exercises in slot order. Each exercise is a section with:
  - Exercise name. **Optional** slots are visually distinguished, e.g. muted styling and an "Optional" tag (rule 20).
  - One row per planned set of the current block:
    - Set number.
    - Target, e.g. "12 reps".
    - **Weight** input (kg), prefilled with last weight, or empty if none (rule 14). Numeric decimal keypad.
    - **Reps** input, prefilled with the target.
    - **Log** button (a tick).

**Behaviour:**

- Tapping Log creates the set log with the current input values and updates last weight (rule 15). The row then switches to a logged state: values shown as text, a check mark, no inputs. Logged sets can't be edited (set logs are immutable; no correction UI in this version).
- Sets can be logged in any order. Unlogged sets are simply not recorded (rule 11).
- Weight may be left empty (bodyweight exercises such as chins or dips).
- Inputs not yet logged survive leaving and returning to the view during the same session (at least within the same browser), so an accidental back-tap doesn't lose typed values.
- **Finish workout** button, always reachable (e.g. sticky at the bottom). Finishing with no sets logged shows a short confirmation ("Finish without logging any sets?"). Otherwise it finishes immediately and returns to the Training block view (rule 12).
- Opening a finished session shows it read-only: logged sets per exercise, and planned sets that weren't logged shown as skipped.

### 6. Programs (list)

**Route:** `/fitness-tracker/programs`

**Shows:**

- All programs. Each row: name, number of blocks, number of workouts, and an "Active" badge on the active program.
- Tapping a program opens Program edit.

**Actions:**

- **New program:** asks for a name and number of blocks (default 4), creates it, and opens Program edit.

### 7. Program edit

**Route:** `/fitness-tracker/programs/[programId]`

**Shows and edits:**

- **Name.**
- **Training blocks:** ordered list of block numbers with an optional label (e.g. "Deload"). Actions: add a block at the end (copies the previous block's sets and reps for every slot, D6), edit a label, remove a block. The last remaining block can't be removed.
- **Workouts:** ordered list. Actions: add (by name), rename, reorder, remove. Tapping a workout opens Workout edit.
- **Status and activation:**
  - Inactive program: **Activate** button (rule 2/3). If another program is active, confirmation states it'll be paused.
  - Active program: "Active" badge, a **Pause** button, and a link to the Active program view.
- **Cycle history:** link to a list of this program's cycles (same as view 2, without the actions when inactive), giving read-only access to past cycles of inactive programs.
- **Delete program:** not available while the program is active (pause it first). Confirmation states that the plan and cycle history will be removed, but logged sets are kept.

**Behaviour:**

- Edits take effect for future sessions only (rule 17). If the program is active, a short note says so.
- Removing a block or workout requires confirmation.
- If the program has an active cycle:
  - Removing the **current block** moves the cycle on to the next block (D4). The confirmation says so: "Block 2 is the current block. Removing it moves you on to block 3."
  - Removing a **workout** moves the suggestion on to the next unfinished workout, or to the next block if every remaining workout in the current block is finished (D5). An in-progress session for that workout is closed, and its logged sets are kept.

### 8. Workout edit

**Route:** `…/programs/[programId]/workouts/[workoutId]`

**Shows and edits:**

- Workout name.
- Ordered list of exercise slots. Each row: exercise name, optional tag if set, and a compact summary of the prescriptions per block (e.g. "3×12 · 3×10 · 3×8 · 2×10").
- Actions: add a slot, reorder, remove (with confirmation). Tapping a slot opens Exercise slot edit.

**Adding a slot** is one form with two required fields:

1. **Exercise:** chosen from the catalog, with the option to create a new exercise inline.
2. **Sets × reps** (e.g. 3 × 10): applied to every block.

Save stays disabled until both are filled in, so a slot is never created without planned sets (D6). Per-block differences (e.g. 3 × 12 in block 1, 3 × 8 in block 3) are then adjusted in Exercise slot edit.

### 9. Exercise slot edit

**Route:** `…/workouts/[workoutId]/slots/[slotId]`

**Shows and edits:**

- **Exercise:** the chosen exercise, with a **Replace** action. Replacing shows a confirmation that the last weights for this slot will be cleared (rule 18).
- **Optional** toggle.
- **One section per training block** (number and label), each listing its planned sets:
  - Each set: set number, target reps (1–999), and **last weight** shown read-only (or "—").
  - Add set, remove set. Removing is disabled when only one set is left in the block (D6). To drop the exercise entirely, remove the slot.
  - **Quick fill:** enter "sets × reps" (e.g. 3 × 12) to replace the block's planned sets in one step. Replacing existing sets requires confirmation if any of them have a last weight.
  - **Copy from previous block:** copies the previous block's set count and target reps (not last weights).

### 10. Exercises (list)

**Route:** `/fitness-tracker/exercises`

**Shows:**

- Active exercises sorted alphabetically, with a search/filter field.
- A toggle to show archived exercises.

**Actions:**

- **New exercise:** name (required, unique within the profile).
- Tapping an exercise opens Exercise edit.

### 11. Exercise edit

**Route:** `/fitness-tracker/exercises/[exerciseId]`

**Shows and edits:**

- **Name:** must stay unique; shows an inline error if taken.
- **Used in:** list of programs and workouts where the exercise is in a slot (read-only, links to Workout edit).
- **Archive / Unarchive.** Archived exercises are hidden from the slot picker but remain in existing slots and history.
- **Delete:** only available for exercises that have no set logs and aren't used in any slot.

---

## Functional requirements

- **FR-001** The fitness tracker home must show the weigh-in row as the first element on the page.
- **FR-002** The "Weigh in" button must be enabled only when no bodyweight entry exists for today (rule 21–22). Next to it, the page shows only the most recent weight ("Last entry: 74.5 kg").
- **FR-003** The Active program, Cycle and Training block views must reflect the derived state from the domain (current block, block completion, next suggested workout) and never compute it differently in the UI.
- **FR-004** The workout session must prefill weight inputs from last weight and reps inputs from the target.
- **FR-005** Logging a set must take a single tap when the prefilled values are correct.
- **FR-006** Logged sets must be shown as read-only in all views.
- **FR-007** Optional exercise slots must be visually distinguishable in the workout session, Workout edit, and read-only session views.
- **FR-008** Destructive or state-changing actions (change block, start over, pause, activate when another is active, replace exercise, remove block/workout/slot, quick fill over existing sets) must ask for confirmation. Logging a set and finishing a workout with logged sets must not.
- **FR-009** All weights are entered and displayed in kg, with up to two decimals (e.g. 61.25). Trailing zeros are not shown (62.5, not 62.50).
- **FR-010** Numeric inputs must open a numeric/decimal keypad on mobile.
- **FR-011** Every view below the home page must have a back link to its parent view.
- **FR-012** Every list view must have an empty state that explains what to do next (e.g. "No programs yet — create one").
- **FR-013** Domain rule violations (e.g. duplicate exercise name, second weigh-in on the same day) must be shown as inline, human-readable messages.
- **FR-014** All views must be usable at iPhone width (from 375 px) in standalone PWA mode, without horizontal scrolling.
- **FR-015** It must not be possible to create an exercise slot, or leave a block of a slot, without at least one planned set (D6).
- **FR-016** "Change block" must offer every later block and block 1 (start over). Skipping forward never changes or removes sessions, set logs or last weights (D1).

## Edge cases

- **No exercises yet** when adding a slot: the picker offers to create one inline.
- **Already on the last block:** "Change block" only offers block 1 (start over).
- **Skipping with a workout in progress:** the confirmation mentions that the open workout will be finished. Its logged sets are kept.
- **Removing the current block when it's the last block:** the cycle completes and a new cycle starts at block 1 (D4).
- **Removing the only unfinished workout in the current block:** the block becomes complete and the cycle moves on (D5).
- **Starting a workout twice:** tapping a workout that already has an in-progress session in this block resumes that session.
- **Stale view:** a session opened on two devices. Logging a set that's already been logged, or finishing a session that's already finished, shows a message and refreshes the view.
- **Day boundary:** the weigh-in "today" follows the user's local time zone (rule 21).
- **Program edited mid-cycle:** a session in progress shows the planned sets as they are when the view is loaded; changes appear the next time it's opened.
- **Last block finished:** the "Block complete" message links to block 1 of the new cycle, not to a non-existent next block.

## Out of scope

- Multiple profiles or a profile list.
- Progress charts and statistics (set logs support them; views come later).
- Alternative exercises.
- Editing or deleting set logs and bodyweight entries.
- Time-based targets (e.g. a 60-second plank) and rep ranges (e.g. 8–12).
- Rest timers, plate calculators, notes per set.
- Offline logging without a connection.
- Units other than kg.
