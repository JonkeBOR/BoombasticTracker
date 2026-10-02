# Feature Specification: Fitness Tracker Domain Model

**Feature Branch**: `feat/setup-domain`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Read @domain-spec.md we are now going to put together the foundational domain structure."

**Source**: [domain-spec.md](../../domain-spec.md) is the authoritative domain description. This spec turns its
concepts, rules 1–22 and acceptance scenarios into testable requirements, and fills the gaps it leaves open
(see Edge Cases and Assumptions).

## Overview

The fitness tracker needs a shared foundation that later features build on: the exercise catalog,
the program builder, training, and profile & bodyweight. This feature provides that foundation. It covers
the concepts of the fitness domain, how they relate to each other, the rules they follow, and how they are
stored durably for each profile. It adds no screens. Each later feature specifies the views and flows that
sit on top of this foundation.

The central idea is that **planned** data (programs) and **performed** data (set logs) are kept apart.
Programs can be edited at any time. Set logs are written once and never changed, so training history
survives any change to programs.

## Clarifications

### Session 2026-10-02

- Q: Should timed exercises such as planks, with targets and logs in seconds, be supported? → A: No.
  Drop them. Every target and every set log is reps only (sets × reps).
- Q: Is a planned set's target a single rep count or can it be a range (e.g. 8–12)? → A: A single
  number of reps; ranges are not supported.

## User Scenarios & Testing _(mandatory)_

"The user" is the person who owns a profile. In this feature, the user acts through domain operations,
not screens. Later feature specs add the screens. Each story can be verified with automated tests
below the screen level.

### User Story 1 - Build a periodized program (Priority: P1)

The user keeps a catalog of exercises and builds a program from them. The program has a chosen number of
training blocks and an ordered list of workouts. Each workout holds ordered exercise slots. For every
training block, each slot has its own prescription: a list of planned sets, each with a target number of reps.

**Why this priority**: Every other capability needs a program to exist. Without a valid plan there is
nothing to train, log or progress through.

**Independent Test**: Create exercises and a program with three blocks, two workouts and several slots
whose prescriptions differ per block. Then read the program back and confirm that its structure, order,
targets and empty last weights are exactly as defined, and that invalid structures are rejected.

**Acceptance Scenarios**:

1. **Given** an empty catalog, **When** the user adds "Incline bench press", **Then** it appears in the
   catalog, and adding another exercise with the same name is rejected.
2. **Given** a program with blocks 1, 2, 3 and a deload block, **When** the user gives an incline bench
   press slot the prescriptions 3×12, 3×10, 3×8 and 2×10, **Then** each block returns its own planned sets,
   numbered from 1, with those targets and no last weight.
3. **Given** a slot, **When** a planned set is defined with a target of zero reps, **Then** it is
   rejected, because every target is a whole number of reps of at least 1.
4. **Given** a program, **When** a training block is added, **Then** every existing slot gets a
   prescription for the new block, and all of its planned sets have empty last weight.
5. **Given** an exercise used in a slot, **When** the user marks the slot optional, **Then** only the
   slot's optional marker changes.

---

### User Story 2 - Train a workout with prefilled weights (Priority: P1)

The user has an active program and opens a workout of the current block. Each planned set shows its target,
plus the weight the user lifted the last time they did that exact set, if there is one. The user logs the
sets they actually do, skips anything they want, and finishes the workout.

**Why this priority**: This is the reason the tracker exists. It records performed work and makes the next
session faster to log.

**Independent Test**: Start from a program with one active cycle. Open a session, log some sets, skip
others, and finish it. Verify that a set log was created for each logged set, that last weights changed
only for the planned sets that were logged, and that a later session for the same block is prefilled with
those weights.

**Acceptance Scenarios**:

1. **Given** block 1 prescribes 3×12 incline bench press, and in cycle 1 block 1 the user logged 65, 62 and
   60 kg, **When** the user opens Upper A in cycle 2 block 1, **Then** sets 1–3 are prefilled with 65, 62
   and 60 kg.
2. **Given** an exercise slot that has never been logged, **When** the user opens the workout, **Then** its
   planned sets show their targets and no suggested weight.
3. **Given** a planned set with last weight 20 kg, **When** the user finishes the workout without logging
   that exercise, **Then** no set log is created and the last weight stays 20 kg.
4. **Given** an open session, **When** the user logs 10 reps at 40 kg for set 2, **Then** a set log is
   created with the exercise, the time it was performed, set 2, 10 reps, 40 kg and its full context
   (program, cycle, block, workout, slot, session), and that planned set's last weight becomes 40 kg.
   Either both of these happen or neither does.
5. **Given** a bodyweight exercise such as chin-ups, **When** the user logs 8 reps with no weight,
   **Then** the set log has no weight, and the planned set's last weight becomes empty.
6. **Given** the current block has four workouts and two are finished, **When** the user asks which
   workout comes next, **Then** the first unfinished workout in workout order is suggested, and any
   unfinished workout can be started.
7. **Given** an open session with no sets logged, **When** the user finishes it, **Then** the session is
   finished and counts towards completing the block.

---

### User Story 3 - Progress through blocks and cycles (Priority: P2)

The user activates a program and works through its blocks. When every workout of a block is finished, the
program moves on to the next block. After the last block, the cycle completes and a new one starts at block

1. After a break, the user can start over from block 1.

**Why this priority**: Periodization only works if the program knows which block the user is in. Progress
is compared between the same block in different cycles.

**Independent Test**: Activate a program, finish every workout of each block in turn, and confirm that the
current block advances, that the cycle completes and a new cycle starts, and that starting over and
switching programs end cycles as specified.

**Acceptance Scenarios**:

1. **Given** the active cycle is on block 2 and three of four workouts have finished sessions, **When** the
   user finishes the fourth workout, **Then** the cycle's current block becomes block 3.
2. **Given** the active cycle is on the last block, **When** the last workout of that block is finished,
   **Then** the cycle is marked completed with an end date, and cycle n+1 starts at block 1.
3. **Given** the active cycle completed blocks 1 and 2 and the user then misses a week, **When** the user
   chooses to start over, **Then** the cycle is marked ended early at block 3, a new cycle starts at block
   1, and all set logs and sessions from the ended cycle remain.
4. **Given** program A is active with a running cycle, **When** the user activates program B, **Then** A is
   no longer active, A's cycle is ended early, and B has an active cycle at block 1. If B already has an
   active cycle, it continues instead.
5. **Given** a program is active, **When** the user pauses it, **Then** the profile has no active program
   and the program's cycle is ended early.
6. **Given** a cycle ends while a session of it is in progress, **When** the cycle is completed or ended
   early, **Then** that session is closed as finished.

---

### User Story 4 - Edit programs without losing history (Priority: P2)

The user changes a program over time: swapping exercises, changing set counts, adding blocks, deleting
programs. History logged earlier is never affected.

**Why this priority**: Programs change all the time. If edits could corrupt history, long-term progress
data could not be trusted.

**Independent Test**: Log sets against a program, then apply each kind of edit, including deleting the
program. Verify that every earlier set log and session is unchanged and readable, and that last weights
were cleared only where the rules say.

**Acceptance Scenarios**:

1. **Given** a slot with seal rows whose planned sets have last weights, **When** the user replaces seal
   rows with machine rows, **Then** all planned sets of that slot have empty last weight, and the seal row
   set logs remain.
2. **Given** a prescription with 3 planned sets that have last weights, **When** the user adds a fourth
   set, **Then** set 4 has empty last weight and sets 1–3 keep theirs.
3. **Given** a program with logged history, **When** the user deletes the program, **Then** every set log
   and session that refers to it still exists unchanged and can still be read.
4. **Given** an exercise referenced by set logs, **When** the user tries to delete it, **Then** deletion is
   refused, and the user can archive it instead. Its history stays readable under its name.

---

### User Story 5 - Record daily bodyweight (Priority: P3)

The user can record their bodyweight at most once per calendar day, whenever they want. They are never
required to.

**Why this priority**: Bodyweight is valuable for trends but does not depend on programs, and it is the
smallest slice.

**Independent Test**: Record a weigh-in, confirm a second one on the same day is refused, and confirm a
weigh-in is available again the next day in the user's time zone.

**Acceptance Scenarios**:

1. **Given** the profile has no bodyweight entry today, **Then** a weigh-in is available.
2. **Given** the profile has recorded bodyweight today, **Then** no further weigh-in is available today.
3. **Given** a weigh-in at 23:30 local time, **When** the user checks at 00:10 local time, **Then** a new
   weigh-in is available, because the day is determined by the user's time zone.

---

### Edge Cases

- **Logging the same planned set twice in one session**: each log is a separate, immutable set log. The
  last weight becomes the most recently logged weight. Correcting mistakes by editing logs is out of scope.
- **Logging outside an in-progress session**: refused. Sets can only be logged in a session that is in
  progress and belongs to the active cycle.
- **Starting a workout that already has an in-progress session** for the current cycle and block: the
  existing session is resumed rather than a second one being created.
- **Starting a workout that is already finished** in the current block: refused (rule 10).
- **A workout with no exercise slots**: it can be started and finished like any other, with no sets.
- **Removing a workout mid-block**: block completion only counts the workouts the program has now. If the
  remaining workouts are all finished, the block completes.
- **Adding a workout mid-block**: the block is not complete until the new workout is finished too.
- **Removing training blocks so the active cycle's current block no longer exists**: the cycle's current
  block moves to the new last block and is then re-evaluated like any other block. Blocks before the
  current one are already finished in this cycle, so the cycle normally completes at once and the next
  cycle starts at block 1. Removing a block after the current one leaves the cycle where it is.
- **Reordering training blocks or workouts**: this changes positions only. Last weights stay with their
  block prescription and planned set, and are not tied to the old position number.
- **Removing planned sets**: their last weights go with them. Remaining sets are renumbered 1…n and keep
  their own last weights.
- **Deleting the active program**: the profile has no active program afterwards. Its sessions and set logs
  are kept.
- **Activating a program with no workouts, or with a slot missing a prescription for some block**: refused
  until the program is complete.
- **Activating the program that is already active**: no change, and no new cycle is started.
- **Archived exercises**: they stay in existing slots and in history, but cannot be put into new slots
  until they are unarchived.
- **Exercise names that differ only in letter case or surrounding spaces**: treated as the same name.
- **Invalid values**: zero or negative reps or weights, and empty names, are rejected.

## Requirements _(mandatory)_

### Functional Requirements

**Ownership**

- **FR-001**: All fitness data (exercises, programs, cycles, sessions, set logs, bodyweight entries) MUST
  belong to exactly one profile, and no data MUST ever be visible to or changeable by another profile.
- **FR-002**: Every signed-in account MUST have a profile, created automatically the first time the account
  needs one.
- **FR-003**: All data MUST be stored durably, so it survives closing the app, signing out and in, and
  later releases of the app.

**Exercise catalog**

- **FR-004**: Users MUST be able to add an exercise with a name that is unique within their profile,
  ignoring letter case and surrounding spaces, and to rename it under the same uniqueness rule.
- **FR-005**: The system MUST refuse to delete an exercise that is referenced by any set log or exercise
  slot. Users MUST be able to archive and unarchive exercises instead.
- **FR-006**: An archived exercise MUST NOT be selectable for a new or replaced slot, and MUST remain
  readable everywhere it is already referenced.

**Program structure**

- **FR-007**: Users MUST be able to create, rename and delete programs. A program MUST always have at least
  one training block. The number of blocks is chosen by the user, with no fixed maximum.
- **FR-008**: Training blocks MUST be ordered 1…N and MAY have a label (e.g. "Deload").
- **FR-009**: Users MUST be able to add, remove, rename and reorder workouts within a program, and add,
  remove, reorder and mark optional the exercise slots within a workout. Each slot holds exactly one
  exercise.
- **FR-010**: Every exercise slot MUST have exactly one block prescription for every training block of its
  program. Adding a block or a slot creates the missing prescriptions.
- **FR-011**: A block prescription MUST be able to hold one or more planned sets numbered 1…n, and
  different blocks MAY prescribe different numbers of sets and different targets.
- **FR-012**: A target MUST be a single whole number of reps of at least 1. Rep ranges (e.g. 8–12) and
  timed targets (durations) are not supported.
- **FR-013**: Every planned set MUST carry a last weight that is empty until that set is first logged.

**Activation**

- **FR-014**: A profile MUST have at most one active program (rule 1).
- **FR-015**: Activating a program MUST deactivate the previously active one and end its active cycle as
  ended early. If the newly activated program has no active cycle, a new cycle MUST start at block 1
  (rules 2–3).
- **FR-016**: Users MUST be able to pause the active program. This leaves the profile with no active
  program and ends the program's active cycle as ended early (rule 2).
- **FR-017**: Activation MUST be refused for a program with no workouts or with any slot that has no
  planned sets for some block.

**Cycles and progression**

- **FR-018**: A program MUST have at most one active cycle. Cycles MUST be numbered 1, 2, 3… in the order
  they start, and record a start date, an end date (empty while running), a status (active, completed or
  ended early) and a current block (rules 4–5).
- **FR-019**: A block MUST count as complete in a cycle when every workout of the program has a finished
  session for that cycle and block. Completion MUST be derived from sessions, not stored separately
  (rule 6).
- **FR-020**: When the current block is complete, the cycle MUST advance to the next block. When the last
  block is complete, the cycle MUST be marked completed and a new cycle MUST start at block 1 (rule 7).
- **FR-021**: Users MUST be able to start over at any time. The active cycle is then marked ended early,
  keeping the block it reached, and a new cycle starts at block 1 (rule 8).
- **FR-022**: When a cycle completes or ends early, any of its sessions still in progress MUST be closed as
  finished (rule 13).
- **FR-023**: Sessions and set logs from earlier cycles, including cycles that ended early, MUST NOT be
  changed by any cycle transition (rule 9).

**Workout sessions**

- **FR-024**: Within the current block of the active cycle, users MUST be able to start any workout that
  has no finished session for that cycle and block. Starting a workout that already has an in-progress
  session MUST resume that session (rule 10).
- **FR-025**: The system MUST suggest the first unfinished workout of the current block, in workout order,
  as the next workout. The suggestion MUST be derived, not stored (rule 10).
- **FR-026**: A session MUST record its program, cycle, block, workout, status (in progress or finished),
  start time and finish time.
- **FR-027**: Users MUST be able to finish a session explicitly with any number of sets logged, including
  none (rule 12). Finishing MUST trigger block and cycle progression (FR-020) as one combined change.

**Prefill and logging**

- **FR-028**: Opening a session MUST present every planned set of the current block for each slot, with its
  target and, if one exists, its last weight as the suggested weight. If there is no last weight, no weight
  is suggested (rule 14).
- **FR-029**: Logging a set MUST create a set log with the exercise, the time it was performed, the set
  number, the reps performed, the weight (optional, in kg) and its context (program, cycle,
  block, workout, slot, session). It MUST also set that planned set's last weight to the logged weight.
  Either both happen or neither does (rule 15).
- **FR-030**: Last weight MUST be specific to one planned set (one slot, one block, one set number). Logging
  a set MUST NOT change the last weight of any other planned set, even one for the same exercise
  (rule 16).
- **FR-031**: Skipping an exercise or some of its sets MUST create no set logs and leave those planned
  sets' last weights unchanged (rule 11).
- **FR-032**: The optional marker MUST NOT affect completion, progression, prefill or logging (rule 20).

**History and immutability**

- **FR-033**: Set logs MUST never be modified or deleted by any operation. That includes program edits,
  exercise replacement, program deletion, cycle transitions and archiving.
- **FR-034**: A set log MUST stay complete and readable on its own after the program, workout or slot it
  refers to has been changed or deleted.
- **FR-035**: It MUST be possible to work out, from set logs alone, the sets, reps and weight per exercise
  over time, optionally grouped by block across cycles. The progress views themselves are out of scope.

**Editing programs**

- **FR-036**: Program edits MUST affect only future sessions. Existing sessions and set logs MUST NOT
  change (rule 17).
- **FR-037**: Replacing the exercise in a slot MUST clear the last weight of all of that slot's planned
  sets in every block (rule 18).
- **FR-038**: Planned sets created by adding sets, blocks or slots MUST start with empty last weight
  (rule 19).
- **FR-039**: After an edit that changes the program's workouts or blocks, block completion and the
  current block MUST be re-evaluated for the active cycle, as described in Edge Cases.

**Bodyweight**

- **FR-040**: Users MUST be able to record a bodyweight entry (date and weight in kg), and a profile MUST
  have at most one entry per calendar day in the user's time zone (rule 21).
- **FR-041**: The system MUST report whether a weigh-in is available today. It is available only if no
  entry exists for today (rule 22). Recording bodyweight MUST never be required.

**Validation**

- **FR-042**: Weights MUST be positive kilogram values and allow fractions (e.g. 22.5 kg). Names MUST NOT
  be empty after surrounding spaces are removed. Invalid input MUST be rejected with a reason the calling
  feature can show to the user, and nothing may be partly saved.

### Key Entities _(include if feature involves data)_

- **Profile**: The owner of all fitness data. It refers to at most one active program.
- **Exercise**: A catalog entry with a name (unique per profile) and an archived flag. It exists
  independently of programs.
- **Program**: A named training plan with ordered training blocks, ordered workouts and its cycles.
- **Training block**: A position 1…N in a program, with an optional label. It has no tie to calendar time.
- **Workout**: A named, ordered session template within a program. It is performed once per block.
- **Exercise slot**: An ordered position in a workout, holding one exercise and an optional marker.
- **Block prescription**: What a slot prescribes for one training block, as an ordered list of planned
  sets.
- **Planned set**: A set number, a target and a last weight (empty until first logged).
- **Target** _(value)_: A single whole number of reps, at least 1 (no ranges).
- **Weight** _(value)_: A positive amount in kilograms.
- **Cycle**: One pass through a program's blocks, with a number, start date, end date, status and current
  block.
- **Workout session**: One performance of one workout in one cycle and block, with a status and start and
  finish times.
- **Set log**: An immutable record of one performed set: the exercise, when it was performed, the set
  number, the reps, an optional weight, and informational context references.
- **Bodyweight entry**: A date and weight for a profile, at most one per calendar day.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All 8 acceptance scenarios in the domain description, and every acceptance scenario in this
  spec, pass as automated checks.
- **SC-002**: Each of the 22 domain rules is covered by at least one automated check that fails if the rule
  is broken.
- **SC-003**: After any sequence of program edits, exercise replacements, archiving, program deletions and
  cycle transitions, 100% of previously recorded set logs are still present, unchanged, and readable with
  their exercise name.
- **SC-004**: In 100% of cases, a set log and the matching last-weight update are either both stored or
  both absent, including when an operation fails partway through.
- **SC-005**: For a program of 10 workouts, 10 slots per workout, 10 blocks and 10 sets per prescription,
  opening a session with all prefilled weights completes in under 1 second.
- **SC-006**: With five years of daily training history (about 100,000 set logs), the full history of one
  exercise, grouped by block across cycles, can be produced in under 2 seconds.
- **SC-007**: Zero records belonging to one profile can be read or changed through another profile.

## Assumptions

- **Scope**: This feature delivers the domain concepts, rules and durable storage, and no screens. The
  exercise catalog, program builder, training and profile & bodyweight features each specify their own
  views on top of it. This makes it a domain-only feature under constitution 2.1.0. Its acceptance
  scenarios are its acceptance tests, written first as Vitest tests, instead of a phone-level Playwright
  test.
- **Profiles**: For now, each signed-in account has exactly one profile. The domain keeps everything
  scoped to a profile, so the profile feature can still decide to allow several profiles per account.
- **Time zone**: "Today" and cycle start and end dates use the user's time zone as reported by their
  device at the time of the action.
- Each workout is performed exactly once per block. Workouts within a block can be done in any order;
  workout order only decides the suggested next workout.
- Weight is optional on a set log, to support bodyweight exercises (chin-ups, dips). Logging a set
  without a weight sets the planned set's last weight to empty.
- Weights are in kg only. Set logs and bodyweight entries cannot be edited or deleted in this version.
- Out of scope: timed exercises (e.g. plank) and any duration-based target or log, alternative
  exercises within a workout, editing or deleting set logs, progress views, units other than kg, and
  calendar scheduling of blocks.
- Using the existing sign-in, every operation acts on the signed-in account's own profile.
