# Implementation Plan: Fitness Tracker UI

**Branch**: `feat/Add-basic-ui` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-fitness-tracker-ui/spec.md`

## Summary

This feature puts the fitness tracker on the phone, with ten screens:

- home with the daily weigh-in
- active program
- current block
- workout session
- programs
- program edit
- workout edit
- slot edit
- exercises
- exercise edit

It also reshapes the cycle into the container the clarifications asked for.

The approach has five parts:

- **Server-rendered pages, thin client leaves.** Each `page.tsx` checks the session, reads through the
  existing fitness operations, and renders a synchronous screen. Interactive pieces are small Client
  Components that call JSON route handlers under `/api/fitness/…`, then `router.refresh()` (research R1).
- **One wrapper for every route handler.** It handles the session, the profile, JSON bodies and the
  mapping from a `Result` code to a status, so each handler is "validate, call, respond" (R2).
- **Blocks by identity.** The cycle's current block and each session's block become block IDs instead of
  positions. That fixes the mid-pass edit problems (FR-043) at their root (R3).
- **The cycle as a container** (FR-045): one row per program, holding the current block and an internal pass
  counter. It is reached through a three-step migration that leaves the immutable `set_logs` table untouched
  (R4, R5).
- **Domain additions**: one skip-to-block operation replaces start over (R6). There are also small read
  additions for block progress, program counts and exercise usage (R8).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `noUncheckedIndexedAccess`), React 19, Next.js 16 App Router.
Node.js ≥ 22.12 locally, Cloudflare Workers (`nodejs_compat`) deployed

**Primary Dependencies**: existing only (Next.js, `@opennextjs/cloudflare`, `drizzle-orm`, `jose`). **No
new dependencies**: no form, validation, data-fetching or UI library (R1, R2, R13)

**Storage**: Cloudflare D1 via the `DB` binding. Two tables change (`cycles`, `workout_sessions`) through
migrations `0002`–`0004`, and `set_logs` is untouched ([data-model.md](data-model.md)). Client-side, only
unlogged set drafts in `localStorage` and a `tz` cookie

**Testing**:

- **Vitest `node`**: pure rules and the session check.
- **Vitest `storage`**: operations, route handlers and the data migration, against a real local D1.
- **Vitest `dom`**: screens and client components.
- **Playwright**: one acceptance test, `e2e/fitness-tracker.spec.ts`, written first (R16).

**Target Platform**: iPhone Safari in standalone Home Screen mode, from 375 px wide. Desktop browsers are
secondary

**Project Type**: web application (Next.js acting as BFF on a single Cloudflare Worker)

**Performance Goals**: the session view is prefilled in ≤ 1 s for 10 exercises × 5 sets (SC-008). One tap
logs a set (SC-001). The suggested workout is ≤ 4 taps from launch (SC-002)

**Constraints**:

- Worker ≤ 3 MiB compressed, on the D1 free tier.
- No interactive transactions, so every multi-row change is one `db.batch` (006).
- At most 100 bound parameters per statement.
- No comments, no inline CSS, and no bare JSX strings (enforced by ESLint).
- Generated migration SQL is never hand-edited.

**Scale/Scope**: one user; 5 user stories, 45 functional requirements, 10 screens and about 22 endpoints
([http-api.md](contracts/http-api.md)). Two new operations and about 14 changed
([operations-delta.md](contracts/operations-delta.md))

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                            | Assessment                                                                                                                                                                                                                                                                                                                                                      | Result |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **I. Simplicity First**              | No new dependency or service. A native `<dialog>` stands in for a modal library, hand-written narrowing for a validation library, and `router.refresh()` for a client cache. The cycle reshape _removes_ a concept: no cycle history, statuses or numbering. The one shared abstraction, the route wrapper (R2), replaces about 22 copies of the same plumbing. | Pass   |
| **II. Server-Mediated Data Access**  | The browser calls only the app's pages and `/api/fitness/*`. Server Components read the server-only operations directly, as docs/04 prescribes. The `DB` binding stays in `src/lib/server/database.ts`.                                                                                                                                                         | Pass   |
| **III. Session/Identity Separation** | Every page uses `requireSession`. Every handler goes through the wrapper's session check (401). The `tz` cookie holds only a time-zone name, no identity. No Google data is touched.                                                                                                                                                                            | Pass   |
| **IV. Free-Tier Hosting**            | Same Worker and D1. The Worker size is checked before merging (quickstart §5).                                                                                                                                                                                                                                                                                  | Pass   |
| **V. Self-Documenting Code**         | All text lives in `src/lib/strings/fitness.ts`, including an exhaustive error-code map. Styling uses CSS Modules and tokens. Migration `0003` is SQL statements only.                                                                                                                                                                                           | Pass   |
| **Technology Stack**                 | Unchanged. Schema changes go through drizzle-kit (generated, custom, generated).                                                                                                                                                                                                                                                                                | Pass   |
| **Development Workflow**             | It exposes the domain to the phone, so it brings one Playwright acceptance test, written first and confirmed failing (R16). Rules, handlers, mapping and component behaviour are driven by Vitest. Layout is checked in a real browser (quickstart §4).                                                                                                         | Pass   |
| **Incremental Decisions**            | This decides the API endpoint design and the UI and component structure, both listed as "decide when needed", and now needed. The cross-cutting parts (the cycle model, identity-based blocks, the route wrapper and its status mapping) are recorded in `docs/architecture/007-…` (quickstart §5). Server Actions are noted, not adopted.                      | Pass   |

**Post-design re-check (after Phase 1)**: Pass. The data model removes columns and indexes rather than
adding mechanisms. The contracts add endpoints only where a screen has a write. The one deviation from
spec 002 (FR-045) is user-requested, recorded in the spec's Clarifications, and its tests are rewritten
rather than dropped. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-fitness-tracker-ui/
├── plan.md                     # This file
├── research.md                 # Phase 0: decisions R1–R17
├── data-model.md               # Phase 1: cycles, workout_sessions, migrations, types
├── quickstart.md               # Phase 1: how to validate
├── contracts/
│   ├── http-api.md             # The /api/fitness/* endpoints
│   ├── operations-delta.md     # Changes to spec 002's operations
│   └── screens.md              # Routes, reads, actions per view
├── checklists/requirements.md
└── tasks.md                    # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
migrations/
├── 0002_cycle_container_columns.sql      # generated
├── 0003_cycle_container_data.sql         # custom (drizzle-kit generate --custom)
└── 0004_cycle_container_schema.sql       # generated

src/app/
├── fitness-tracker/
│   ├── layout.tsx                        # mounts TimeZoneCookie
│   ├── page.tsx + FitnessHomeScreen.tsx (+ .module.css, .test.tsx)   # replaces FitnessTrackerScreen
│   ├── active/
│   │   ├── page.tsx + ActiveProgramScreen.tsx
│   │   ├── block/page.tsx + CurrentBlockScreen.tsx
│   │   └── sessions/[sessionId]/page.tsx + WorkoutSessionScreen.tsx
│   ├── programs/
│   │   ├── page.tsx + ProgramsScreen.tsx
│   │   └── [programId]/
│   │       ├── page.tsx + ProgramEditScreen.tsx
│   │       └── workouts/[workoutId]/
│   │           ├── page.tsx + WorkoutEditScreen.tsx
│   │           └── slots/[slotId]/page.tsx + SlotEditScreen.tsx
│   └── exercises/
│       ├── page.tsx + ExercisesScreen.tsx
│       └── [exerciseId]/page.tsx + ExerciseEditScreen.tsx
└── api/fitness/                          # one route.ts per row of http-api.md
    ├── bodyweight/route.ts
    ├── exercises/route.ts, exercises/[id]/route.ts
    ├── programs/route.ts, programs/[id]/{route,blocks/route,workouts/route,activation/route}.ts
    ├── blocks/[id]/route.ts
    ├── workouts/[id]/{route,slots/route,session/route}.ts
    ├── slots/[id]/route.ts, slots/[id]/prescriptions/[blockId]/route.ts
    ├── active-program/route.ts, active-program/skip/route.ts
    └── sessions/[id]/{sets/route,finish/route}.ts

src/features/fitness-tracker/
├── domain/
│   ├── progression.ts        # decideAfterFinish, decideSkip, reevaluateAfterEdit, blockStatuses (reworked)
│   ├── logging.ts            # + isPlannedSetLogged
│   ├── values.ts             # + parseKgInput, formatKg
│   ├── history.ts            # groupByBlockAcrossPasses
│   └── types.ts              # Cycle, Program, TrainingOverview, SessionView, ExerciseUsage …
├── server/
│   ├── schema.ts             # cycles and workout_sessions reshaped; set_logs.pass ↔ cycle_number
│   ├── http.ts               # respond, authorize, body readers (new, pure)
│   ├── fitness-route.ts      # fitnessRoute: session, database, profile (new, the edge)
│   ├── handlers/             # handle… functions, one module per resource, + *.storage.test.ts (new)
│   ├── activation.ts         # activate, pause, skipToBlock (startOver, listCycles removed)
│   ├── cycle-statements.ts   # startPassStatements, closeInProgressStatements
│   ├── training.ts, programs.ts, exercises.ts   # changed per operations-delta.md
│   └── cycle-migration.storage.test.ts          # new
└── components/               # ConfirmDialog, useFitnessAction, InlineError, BackLink, TimeZoneCookie,
                              # useSetDrafts, (+ .module.css, .test.tsx)

src/lib/strings/fitness.ts    # all fitness text + fitnessErrorStrings (new)
src/app/globals.css           # a few new tokens + dark-mode re-declarations
e2e/fitness-tracker.spec.ts   # the acceptance test (new); e2e/app-foundation.spec.ts updated
docs/architecture/007-cycle-as-container.md   # new
```

**Structure Decision**: This keeps the existing layout:

- **Pages and screens** live together in `src/app/`, as `fitness-tracker/` and `sign-in/` already do.
- **Feature logic** lives in `src/features/fitness-tracker/` (domain, server).
- **Shared fitness UI** gets a `components/` folder inside the feature, because it has a real occupant and
  a single consumer.
- **No `src/components/`** is created, because nothing outside the fitness tracker uses these pieces yet.

The placeholder `FitnessTrackerScreen` is replaced by `FitnessHomeScreen`. `featureStrings.fitnessTracker.title`
and `.description` stay, because the landing page uses them, and `placeholder` is removed.

## Implementation order (for /speckit-tasks)

1. **Acceptance test first**: `e2e/fitness-tracker.spec.ts`, confirmed failing (R16).
2. **The domain reshape (FR-045, FR-043, FR-042, FR-040)**:
   - pure rules first
   - then `schema.ts` and migrations `0002`–`0004` with the migration storage test
   - then the operations
   - spec 002's cycle tests rewritten, and the rest kept green
3. **The BFF foundation**: `http.ts` and `fitness-route.ts`, `fitnessErrorStrings`, `ConfirmDialog`, `useFitnessAction`, the
   `tz` cookie and the shared tokens.
4. **User stories in priority order, each a vertical slice** (operations delta → handlers → screens):
   - US2 weigh-in
   - US3 program building, with the exercise picker's inline create
   - US4 activation and skip/pause
   - US1 training
   - US5 exercises
     US1 depends on US3 and US4 to have data, so it comes after them, even though it is P1.
5. **Polish**: dark mode, the 375 px pass, the phone walk-through (quickstart §4), ADR 007, and the Worker
   size check.

## Complexity Tracking

_No constitution violations to justify._
