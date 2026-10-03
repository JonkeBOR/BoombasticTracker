# Feature Specification: Fitness Tracker UI

**Feature Branch**: `feat/Add-basic-ui`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "We are now moving on to implementing the basic ui for the fitness tracker. read
@src/app/ui-spec.md , **one caviat** the agent that wrote this spec doesnt have full insight into how the domain
was actually implemented. Honor the functional requirements while doing your best to keep the domain
implementation intact."

**Sources**: [ui-spec.md](ui-spec.md) describes the views, their layout and the flows between
them. [Spec 002](../002-fitness-domain-model/spec.md) and its
[operations contract](../002-fitness-domain-model/contracts/fitness-operations.md) describe the domain that is
already built. This spec turns the UI description into testable requirements. Where `ui-spec.md` assumes
something about the domain that the implementation doesn't do, this spec decides what happens and records the
decision under **Reconciliation with the implemented domain**. Where the two documents differ, this spec wins.
View layouts that this spec doesn't restate are taken from `ui-spec.md`.

## Overview

The fitness domain exists but has no screens. This feature adds the screens of the fitness tracker. With them,
the user can weigh in, build programs from a catalog of exercises, activate a program, and train through its
blocks at the gym. Looking back at past passes and sessions is out of scope. The phone is the primary device,
and the workout session screen matters most because it is used between sets.

The domain stays as built except in two areas. First, the cycle becomes a simple container for where the user
is in a program, instead of a record of each pass through it (FR-045). History lives in the set logs. Second,
this feature adds what the screens can't do without: skipping to another block, a few read-only summaries of
existing data, and corrections where program edits in the middle of a pass currently behave differently from
what the user expects (see FR-040 to FR-045).

## Reconciliation with the implemented domain

These are the places where `ui-spec.md` and the implemented domain disagree, and how this spec resolves each
one. Each resolution keeps the domain as built or extends it, except R10, which changes the cycle at the user's
request.

| #   | `ui-spec.md` assumes                                                                                             | Implemented domain                                                                                                                                                                                                                                                      | Resolution                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Quick fill and "copy from previous block" **replace** a block's planned sets, losing last weights.               | A prescription change is positional. Set _n_ keeps its last weight, and only sets beyond the new count are removed.                                                                                                                                                     | Keep the domain. Quick fill and copy change targets in place. Sets 1…n keep their last weights. A confirmation is shown only when the change removes sets that have a last weight (FR-030).                                                                                                              |
| R2  | Any planned set can be removed.                                                                                  | Planned sets are always numbered 1…n, and the prescription change removes from the end.                                                                                                                                                                                 | Each block offers **Remove last set**. A set in the middle can't be removed on its own (FR-029).                                                                                                                                                                                                         |
| R3  | Logging a set that's already logged is refused (stale view).                                                     | Logging the same planned set twice creates two set logs. That's an accepted edge case of spec 002.                                                                                                                                                                      | Keep the domain. The screens never offer a second log for a planned set that already has one in the session, and a stale attempt is answered with a message and a refreshed view (FR-019).                                                                                                               |
| R4  | Jump to a later block (D1).                                                                                      | Not available. Only "start over" exists.                                                                                                                                                                                                                                | New domain behaviour (FR-040): one "skip to block" operation covers later blocks and block 1, and replaces start over.                                                                                                                                                                                   |
| R5  | Skipped blocks and block progress (D3), plus history of past cycles and sessions.                                | Only the current block of the active cycle can be read, plus a session by its ID.                                                                                                                                                                                       | History is out of scope (Clarifications). A new read-only summary gives each block's status and progress in the current pass, derived from stored sessions. Nothing new is stored (FR-041).                                                                                                              |
| R6  | Removing a workout closes its in-progress session (D5).                                                          | The workout is removed, and its in-progress session stays open with nothing to return to.                                                                                                                                                                               | New domain behaviour: the session is closed as finished in the same change (FR-042). Existing re-evaluation of the current block is kept.                                                                                                                                                                |
| R7  | Removing the current block moves on to the next block. Removing any other block doesn't change it (D4).          | Sessions are tied to a block's **position**. Removing a block shifts later blocks down one position. As a result, removing an earlier block silently moves the user one block forward, and removing the current block attaches its finished workouts to the next block. | New domain behaviour (FR-043). The user stays on the same block when an earlier block is removed. After the current block is removed, the next block becomes current with none of its workouts finished. When the removed block was the last one, a new pass starts even if earlier blocks were skipped. |
| R8  | Programs list shows block and workout counts. Exercise edit shows where it's used and whether it can be deleted. | The program summary has no counts. The exercise catalog doesn't report usage, and refuses a delete only when it's tried.                                                                                                                                                | New read-only data for those views (FR-041). Deletion is still decided by the domain's own refusal.                                                                                                                                                                                                      |
| R9  | Deleting a program removes its plan and cycle history.                                                           | Matches. The domain also allows deleting the active program.                                                                                                                                                                                                            | The screens don't offer delete while the program is active (FR-033). The domain is unchanged.                                                                                                                                                                                                            |
| R10 | Cycles are numbered, dated and listed (active, completed, ended early). Pausing ends the cycle.                  | Each pass is its own cycle row with a number, a status, and start and end dates. Pausing or switching programs ends it early, and reactivating starts a new pass at block 1.                                                                                            | Changed at the user's request (Clarifications, FR-045). Each program has one cycle, kept for its lifetime, holding the current block and an internal pass counter. Status and dates are dropped. Pausing keeps the position.                                                                             |

## Clarifications

### Session 2026-10-03

- Q: When the user picks a block in "Skip to block", what should each choice do? → A: One "Skip to block"
  action offers every later block plus block 1. A later block moves forward within the cycle. Block 1 ends the
  cycle early and starts a new one at block 1. This one operation replaces the domain's separate start over.
  (Restated for the cycle model below: block 1 starts a new pass of the same cycle.)
- Q: Once workout and session history are out of scope, how much of the cycle and block navigation should stay?
  → A: The active program view shows only the active cycle: its blocks with status (complete, current,
  upcoming, skipped) and progress. Only the current block opens. Past cycles, finished sessions, the read-only
  session view and program cycle history are dropped.
- Q: What should happen to a cycle when a pass through the program ends? → A: A program has one cycle for its
  whole life. It is reset in place to block 1 when a pass ends. It has no number, start or end date, or status.
- Q: When the cycle resets to block 1 for a new pass, what happens to the sessions of the pass that just ended?
  → A: The cycle keeps a pass counter, and each session is stamped with it, so sessions of earlier passes no
  longer count towards the current one.
- Q: When the user pauses the active program and activates it again later, does it continue or start again?
  → A: It continues. Pausing, or activating another program, keeps the cycle on its current block, and an
  in-progress session is closed as finished when the program is paused.
- Q: Should the user see the pass counter? → A: No. It is internal only. The screens show program and block,
  never a cycle number. Sessions and set logs still record it.

## User Scenarios & Testing _(mandatory)_

"The user" is the signed-in person. Each account has exactly one profile, found automatically. The user never
creates or chooses a profile.

### User Story 1 - Log a workout at the gym (Priority: P1)

At the gym, the user opens the active program and drills down to today's workout. Each set is already filled in
with the weight lifted last time, so logging a set takes one tap.

**Why this priority**: This is why the tracker exists. Everything else serves this moment.

**Independent Test**: Starting from an active program with history in an earlier pass, open the suggested
workout on a phone-sized screen. Check the prefilled weights, log one set unchanged, log one with a changed
weight, finish, and check the block view.

**Acceptance Scenarios**:

1. **Given** an active program on block 1 of its second pass, **When** the user opens the active program,
   **Then** it shows block 1 as current with no cycle number, and opening block 1 shows its workouts with the
   suggested one highlighted.
2. **Given** incline bench press logged 65, 62 and 60 kg for sets 1–3 in block 1 of the previous pass, **When**
   the user opens that workout in block 1 of this pass, **Then** sets 1–3 show 65, 62 and 60 kg prefilled.
3. **Given** a prefilled set, **When** the user taps its log button without changing anything, **Then** a set
   log is recorded with the prefilled weight and the target reps, and the set is shown as logged.
4. **Given** a prefilled set, **When** the user changes the weight to 67.5 and logs it, **Then** the set log
   records 67.5 kg.
5. **Given** an exercise with no history, **When** the user opens the workout, **Then** its sets show the
   target reps and an empty weight field.
6. **Given** some sets are logged, **When** the user taps "Finish workout", **Then** the session is finished
   without a confirmation and the user is back on the block view, where the workout is marked finished.
7. **Given** the workout is the last unfinished one in its block, **When** the user finishes it, **Then** the
   block view says the block is complete and links to the next block, or to block 1 if it was
   the last block.
8. **Given** a workout with typed but unlogged values, **When** the user goes back and opens it again in the
   same browser, **Then** the typed values are still there.

---

### User Story 2 - Daily weigh-in (Priority: P1)

Recording today's bodyweight is the first thing the user sees in the fitness tracker. It is always optional.

**Why this priority**: It is the smallest daily habit, independent of programs, and sits at the top of the
home page.

**Independent Test**: Open the fitness tracker with and without an entry for today, record a weigh-in, and
check the button state and the "Last entry" text.

**Acceptance Scenarios**:

1. **Given** no entry today and a previous entry of 74.5 kg, **When** the user opens the fitness tracker,
   **Then** the top of the page shows an enabled "Weigh in" button next to "Last entry: 74.5 kg".
2. **Given** the user taps "Weigh in", enters 74.2 and saves, **Then** the entry is stored, the text reads
   "Last entry: 74.2 kg" and the button is disabled.
3. **Given** an entry exists for today, **When** the user opens the fitness tracker, **Then** the button is
   disabled.
4. **Given** no entries at all, **Then** the button is enabled and no "Last entry" text is shown.
5. **Given** the user taps "Weigh in" and then cancels, **Then** nothing is saved.
6. **Given** the user never weighs in, **Then** nothing else in the tracker is affected.

---

### User Story 3 - Build a program (Priority: P1)

The user creates a program with training blocks and workouts. For each exercise in a workout, the user sets the
sets and reps per block.

**Why this priority**: Nothing can be trained without a program. US1 depends on it in practice.

**Independent Test**: From an empty account, create exercises, a program with 4 blocks, a workout and a slot,
adjust one block's prescription, and read it all back from the screens.

**Acceptance Scenarios**:

1. **Given** the program list, **When** the user creates "Strength" with 4 blocks, **Then** the user lands on
   its edit page, which shows blocks 1–4 and no workouts.
2. **Given** a program, **When** the user adds the workout "Day 1", **Then** it appears in the workout list and
   can be opened.
3. **Given** a workout, **When** the user adds incline bench press, **Then** the slot can't be saved until both
   an exercise and sets × reps (e.g. 3 × 10) are entered, and once saved, every block has 3 planned sets of 10
   reps.
4. **Given** a slot, **When** the user quick-fills block 1 with 3 × 12, **Then** block 1 has three sets of 12
   reps, and the sets keep any last weights they had.
5. **Given** a block with one planned set, **Then** removing that set isn't offered.
6. **Given** a slot, **When** the user marks it optional, **Then** it's shown in the optional style in Workout
   edit and the workout session.
7. **Given** a program, **When** the user adds a block, **Then** the new block appears last, and every slot has
   the same sets and reps in it as in the block before, with no last weights.

---

### User Story 4 - Activate, pause and skip to a block (Priority: P2)

The user chooses which program is active, pauses it, or skips to another block: ahead to a later block, or back
to block 1 to start the program again.

**Why this priority**: Activation is needed before US1 can happen at all, but it's a one-off action. Skipping is
occasional.

**Independent Test**: With two programs, activate one, switch to the other, skip to a later block, skip to
block 1, pause, and reactivate, checking the active program and block views after each step.

**Acceptance Scenarios**:

1. **Given** program B is active, **When** the user activates program A, **Then** a confirmation says B will
   be paused and keep its place. After confirming, A is active on its current block, or on block 1 if it has
   never been active.
2. **Given** a program with no workouts, **When** the user tries to activate it, **Then** a message explains
   that it needs at least one workout, and nothing changes.
3. **Given** a 4-block program on block 2, **When** the user chooses "Skip to block", **Then** the choices are
   block 3, block 4, and block 1 (start again).
4. **Given** the user picks block 4 and confirms, **Then** block 4 is current, its first workout is suggested,
   blocks 2 and 3 are shown as skipped, and every logged set is kept.
5. **Given** the user jumped to block 4, **When** the user opens its first workout, **Then** the sets are
   prefilled with their last weights as usual.
6. **Given** the user picks block 1 and confirms, **Then** block 1 is current with no workouts
   finished, and every logged set is kept.
7. **Given** the active program, **When** the user pauses it and confirms, **Then** the home page shows no
   active program and links to the program list.
8. **Given** a workout is in progress in the current block, **When** the user skips to another block, **Then** the
   confirmation says the open workout will be finished, and its logged sets are kept.
9. **Given** a program paused on block 3 with two of its workouts finished, **When** the user activates it
   again, **Then** block 3 is current and those two workouts are still finished.

---

### User Story 5 - Manage exercises (Priority: P2)

The user keeps a catalog of exercises to choose from when building workouts.

**Why this priority**: Slots need exercises, but an exercise can also be created inline while adding a slot,
so the catalog screens can come after the program builder.

**Independent Test**: Add, rename, archive, unarchive and delete exercises from the catalog screens, and check
which ones the slot picker offers.

**Acceptance Scenarios**:

1. **Given** the exercise list, **When** the user adds "Seal rows", **Then** it appears in the list and can be
   chosen for a slot.
2. **Given** "Chins" exists, **When** the user adds "chins ", **Then** an inline message says the name is
   taken.
3. **Given** an exercise with set logs, **When** the user opens its edit page, **Then** it can be archived but
   not deleted.
4. **Given** an exercise that's archived, **Then** it's missing from the slot picker, still appears in existing
   slots, and is listed when the user shows archived exercises.
5. **Given** an exercise used in two workouts, **When** the user opens its edit page, **Then** both workouts
   are listed with their programs and link to Workout edit.

---

### Edge Cases

- **No exercises yet** when adding a slot: the picker offers to create one inline.
- **Already on the last block**: "Skip to block" offers only block 1 (start again).
- **Removing the current block when it's the last block**: the program starts a new pass at block
  1, even if earlier blocks were skipped.
- **Removing a block before the current one**: the user stays on the same block, now shown under its new
  number.
- **Removing the only unfinished workout in the current block**: the block becomes complete and the program
  moves on.
- **Removing a workout that's in progress**: its session is closed as finished and its logged sets are kept.
- **Starting a workout that's already in progress** in this block: the existing session is resumed.
- **Stale view**: a session is open on two devices. Logging a set that's already logged, or finishing a session
  that's already finished, shows a short message and refreshes the view. No second set log is created.
- **Day boundary**: "today" for the weigh-in follows the device's time zone.
- **Program edited mid-pass**: an open workout keeps showing the planned sets it loaded with. Changes appear the
  next time it's opened.
- **Last block finished**: the "Block complete" message links to block 1, where the next pass starts.
- **Editing a paused program**: removing its current block or a workout moves its saved position exactly as it
  would for the active program, so reactivating it continues from a block that still exists.
- **Unknown or another person's item** in an address (a program, workout, slot, exercise or session that doesn't
  exist or isn't the user's): a not-found page with a link back home. Nothing about other accounts is revealed.
- **Signed out or expired session**: any fitness page sends the user to sign in and back afterwards.
- **Opening the active program view with nothing active**: the user is sent home.
- **Weight with more than two decimals, zero or a negative value, or reps outside 1–999**: an inline message,
  and nothing is saved.
- **Opening a finished workout or a block other than the current one** by its address: the user is sent to the
  current block.
- **A workout with no exercises**: it can be started and finished. The session view says there's nothing to
  log.

## Requirements _(mandatory)_

### Functional Requirements

**Navigation and layout**

- **FR-001**: The fitness tracker MUST be reached from the app's landing page, and every fitness page MUST
  require a signed-in user.
- **FR-002**: The views MUST form a drill-down tree: home → active program → current block →
  workout session; home → programs → program edit → workout edit → slot edit; and home → exercises → exercise
  edit. There is no history view.
- **FR-003**: Every view below home MUST have a back link to its parent view.
- **FR-004**: Every view MUST be usable from 375 px wide in standalone Home Screen mode, without horizontal
  scrolling. Primary actions MUST be large enough to tap reliably with one thumb.
- **FR-005**: Every list MUST have an empty state that says what to do next.

**Home**

- **FR-006**: The weigh-in row MUST be the first element on the home page. It contains only a "Weigh in" button
  and, if any entry exists, "Last entry: X kg" with the most recent weight.
- **FR-007**: "Weigh in" MUST be enabled only when there's no entry for today in the device's time zone. It
  opens a weight input with Save and Cancel.
- **FR-008**: The home page MUST show the active program card: program name, current block (number and label),
  and suggested workout, linking to the active program view. With no active program, it says so and
  links to Programs.
- **FR-009**: The home page MUST link to Programs and Exercises.

**Active program and current block**

- **FR-010**: The active program view MUST show the program name, with actions to skip to a block and to
  pause, and a link to Program edit. No cycle number, dates or past passes are shown anywhere.
- **FR-011**: The active program view MUST list every block of the program in order with its label, its
  progress ("3 / 4 workouts") and one status: complete, current, upcoming or skipped. A block before the
  current block that isn't complete is skipped. The current block MUST be highlighted.
- **FR-012**: Only the current block MUST open the block view.
- **FR-013**: The block view MUST list the program's workouts in order, each finished (with its date), in
  progress or not started, and MUST highlight the suggested workout.
- **FR-014**: Tapping any not-started workout in the current block MUST start it, and tapping an in-progress
  workout MUST resume it.
- **FR-015**: Right after the last unfinished workout of a block is finished, the user MUST see that the block
  is complete, with a link to the next block, or to block 1 after the last block.
- **FR-016**: Current block, completion, skipped state and the suggested workout MUST come from the domain.
  The screens MUST NOT work them out differently.

**Workout session**

- **FR-017**: The session view MUST show the workout name and block, then each exercise in slot order
  with one row per planned set of the session's block: set number, target ("12 reps"), a weight input
  prefilled with the last weight (empty if none), a reps input prefilled with the target, and a log button.
- **FR-018**: Logging a set MUST take a single tap when the prefilled values are right, with no confirmation.
  The weight MAY be left empty.
- **FR-019**: A logged set MUST switch to a read-only logged state, with no inputs. A planned set with a set log
  in the session MUST NOT be offered for logging again.
- **FR-020**: Sets MAY be logged in any order, and unlogged sets are simply not recorded.
- **FR-021**: Values typed but not yet logged MUST survive leaving and reopening the session in the same
  browser.
- **FR-022**: "Finish workout" MUST always be reachable without scrolling to the end. Finishing with no sets
  logged MUST ask for confirmation. Otherwise it finishes at once and returns to the block view.
- **FR-023**: A finished workout MUST be shown as finished and MUST NOT open. Viewing finished sessions is out
  of scope.
- **FR-024**: Optional slots MUST be visibly distinguished, with muted styling and an "Optional" tag, in the
  session view and Workout edit.

**Programs**

- **FR-025**: The program list MUST show each program's name, number of blocks, number of workouts, and an
  "Active" badge on the active one. "New program" asks for a name and a block count (default 4) and opens the
  new program's edit page.
- **FR-026**: Program edit MUST allow renaming the program, adding a block at the end, labelling a block,
  removing a block (not the last remaining one), and adding, renaming, reordering and removing workouts.
- **FR-027**: Workout edit MUST allow renaming the workout and adding, reordering and removing slots, with each
  slot showing its exercise, its optional tag and a summary of sets × reps per block (e.g. "3×12 · 3×10 · 3×8").
- **FR-028**: Adding a slot MUST be one form with two required inputs, an exercise from the catalog (or a new
  one created inline) and sets × reps, applied to every block. It MUST NOT be possible to save it without both.
- **FR-029**: Slot edit MUST allow replacing the exercise, toggling optional, and per block: adding a set,
  removing the last set (not when only one is left), changing a set's target reps (1–999), quick fill with sets
  × reps, and copying the previous block's sets and reps. Each set shows its last weight read-only, or "—".
- **FR-030**: Quick fill and copy MUST keep the last weights of the sets that remain. They MUST ask for
  confirmation only when they would remove sets that have a last weight.
- **FR-031**: Replacing a slot's exercise MUST ask for confirmation, saying that the slot's last weights will
  be cleared.
- **FR-032**: Program edit MUST offer Activate for an inactive program, and an "Active" badge, Pause and a link
  to the active program view for the active one. Edits to an active program MUST show a note that they apply to
  future sessions only.
- **FR-033**: Delete program MUST NOT be offered while the program is active. Its confirmation MUST say that the
  plan and its place in the program will be removed and logged sets kept.
- **FR-034**: Removing the current block or a workout of an active program MUST say in its confirmation what
  happens to the current block (e.g. "Block 2 is the current block. Removing it moves you on to block 3.").

**Exercises**

- **FR-035**: The exercise list MUST show active exercises alphabetically, with a filter field and a toggle to
  show archived exercises, and MUST allow adding an exercise by name.
- **FR-036**: Exercise edit MUST allow renaming, archiving and unarchiving, MUST list the programs and workouts
  that use the exercise, and MUST offer delete only for an exercise with no set logs that isn't in any slot.
- **FR-037**: Archived exercises MUST NOT be offered when choosing an exercise for a slot.

**Confirmations, messages and units**

- **FR-038**: These actions MUST ask for confirmation: skip to block, pause, activate while another
  program is active, replace a slot's exercise, remove a block, workout or slot, delete a program or exercise,
  quick fill or copy that removes sets with last weights, and finishing a workout with no sets logged. Logging a
  set and finishing a workout with sets logged MUST NOT.
- **FR-039**: Every refusal from the domain (e.g. name taken, already weighed in today, program has no workouts,
  workout already finished) MUST be shown as a short inline message in plain language, with no change saved.
  Weights MUST be entered and shown in kg with at most two decimals and no trailing zeros (62.5, not 62.50).
  Numeric inputs MUST open a numeric or decimal keypad on the phone.

**Domain additions** (behaviour the screens need that the domain doesn't have yet)

- **FR-040**: The domain MUST offer one "skip to block" operation for the active program, replacing the
  separate start over. It accepts any block after the current one, or block 1. Any in-progress session of the
  program is closed as finished. No set log or last weight is created, changed or removed.
  - **A later block**: the pass continues and the chosen block becomes current. The blocks passed over are left
    as they are, and the chosen block's first unfinished workout is suggested. Finishing the last block still
    starts a new pass.
  - **Block 1**: a new pass starts at block 1.
  - **Any other block** (the current block, or an earlier block other than 1) is refused.
- **FR-041**: The domain MUST provide, read-only and without storing anything new: each block's status and
  progress in the active program's current pass; each program's block and workout counts; and, for an exercise, the workouts
  that use it and whether it has set logs.
- **FR-042**: Removing a workout MUST close its in-progress session as finished in the same change, keeping its
  set logs.
- **FR-043**: Removing a block from a program MUST keep the user on the same block when the
  removed block came before it. When the current block itself is removed, the next block MUST become current
  with none of its workouts counted as finished. When the removed current block was the last one, a new pass
  MUST start at block 1, even if earlier blocks were skipped. This applies whether the program is active or
  paused. Sessions and set logs
  MUST NOT be removed.
- **FR-044**: Every existing domain behaviour and its tests from spec 002 MUST keep working, except where
  FR-040 replaces start over, FR-042 and FR-043 change edits in the middle of a pass, and FR-045 changes the
  cycle. Start over's behaviour (spec 002 FR-021) is kept as skipping to block 1.
- **FR-045**: The cycle MUST be a container for where the user is in a program, not a record of each pass. This
  replaces spec 002 FR-018 to FR-023 where they conflict.
  - Each program has exactly one cycle for its whole life. It holds the current block and a pass counter, and
    has no number shown to the user, no status, and no start or end date. It is removed only with its program.
  - A new pass increments the counter and resets the current block to 1. A pass ends by finishing the last
    block, by skipping to block 1 (FR-040), or by removing the current block when it is the last one (FR-043).
    In-progress sessions of the ending pass are closed as finished.
  - Each session records the pass it belongs to. Only sessions of the current pass count towards block
    completion, workout status and the suggested workout. One session per workout per block per pass.
  - Pausing the active program, or activating another one, keeps the paused program's current block and closes
    its in-progress session as finished. Activating a program continues from its current block, or starts its
    first pass at block 1 if it has never been active. Activating the program that is already active changes
    nothing.
  - Set logs already stored are not changed. New set logs record the pass counter in their context, where they
    used to record the cycle number, so history can still be grouped by block across passes.

### Key Entities _(include if feature involves data)_

No new stored entities. The screens present the entities of spec 002 (profile, exercise, program, training
block, workout, exercise slot, block prescription, planned set, cycle, workout session, set log, bodyweight
entry). One entity changes:

- **Cycle** (changed by FR-045): one per program, for the program's whole life. It holds the current block and
  an internal pass counter. It has no status, no number shown to the user, and no dates.
- **Pass** _(term)_: one run through a program's blocks, from block 1. The pass counter identifies it. It is not
  stored as a separate record.

The following are derived for display and never stored:

- **Block status in the current pass**: complete, current, upcoming or skipped, with progress as finished
  workouts out of the program's workouts.
- **Exercise usage**: the program and workout of every slot that holds the exercise, and whether any set log
  refers to it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On a phone, logging a set whose prefilled values are right takes exactly one tap, and a full
  workout of 5 exercises × 3 sets with no changes can be logged and finished in at most 17 taps after the
  session opens.
- **SC-002**: From opening the app on the Home Screen, the user reaches the suggested workout's session in at
  most 4 taps.
- **SC-003**: Recording today's bodyweight takes at most 3 interactions from the fitness tracker home (tap,
  enter, save).
- **SC-004**: Every acceptance scenario in this spec passes as an automated check, and the phone-level
  acceptance test passes at iPhone width.
- **SC-005**: No view needs horizontal scrolling at 375 px wide.
- **SC-006**: Every domain refusal reachable from a screen shows a readable message, with zero cases where the
  user sees a raw error code or a generic failure page.
- **SC-007**: Skipping to a block, pausing, and removing blocks or workouts leave 100% of previously
  recorded set logs present and unchanged.
- **SC-008**: Opening the workout session view shows prefilled values within 1 second on a phone for a workout
  of 10 exercises with 5 sets each.

## Assumptions

- **Scope**: All five stories are one feature. Under constitution 2.1.0 it exposes the domain to the phone, so it
  starts with one Playwright acceptance test written first. The test covers the main journey: build a program
  with one workout and one exercise, activate it, open the suggested workout, log a set and finish.
- **Profiles**: one profile per account, found automatically. No profile screens.
- **Time zone**: the device reports its time zone with every action where the day matters (weigh-in).
- **Dates**: workouts' finish dates are shown in the device's locale and time zone.
- **Block progress** counts the program's current workouts, so a workout removed mid-pass no longer counts.
- **Typed values** are kept on the device only, until they are logged. Nothing unlogged is stored on the
  server.
- **Reordering** workouts and slots uses simple move up/down actions. Blocks can't be reordered from the
  screens, although the domain supports it.
- **Online only**: no offline logging.
- **Out of scope**: history views of past passes, blocks, workouts and sessions (including read-only finished
  sessions), profile lists, progress charts and statistics, alternative exercises,
  editing or deleting set logs and bodyweight entries, time-based targets and rep ranges, rest timers, plate
  calculators, notes per set, and units other than kg.
