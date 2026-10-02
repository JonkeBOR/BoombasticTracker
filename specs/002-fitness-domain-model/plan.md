# Implementation Plan: Fitness Tracker Domain Model

**Branch**: `feat/setup-domain` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-fitness-domain-model/spec.md`

## Summary

This feature builds the fitness tracker's domain foundation:

- the exercise catalog
- periodized programs (blocks × workouts × slots × planned sets)
- cycles and block progression
- workout sessions
- immutable set logs with per-planned-set prefill
- daily bodyweight

It adds no screens. Later features call it through a set of server-only operations.

The approach is a functional core with an imperative shell:

- **Rules are pure TypeScript** in `src/features/fitness-tracker/domain/`, unit-tested in
  microseconds.
- **Thin server-only operations** in `src/features/fitness-tracker/server/` load rows with Drizzle
  over D1, apply the rules, and write each change as one atomic `batch`.
- **Drizzle arrives with the first tables**, as constitution 2.1.0 now requires. Its migrations go
  straight into Wrangler's `migrations/` folder.
- **Storage behaviour** (atomicity, immutability, profile isolation, performance) is tested in a new
  Vitest `storage` project against a real local D1 started with Wrangler's `getPlatformProxy`.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `noUncheckedIndexedAccess`) on Node.js ≥ 22.12 locally,
Cloudflare Workers runtime (`nodejs_compat`) deployed

**Primary Dependencies**: Next.js 16 (existing), `@opennextjs/cloudflare` (existing, provides
`getCloudflareContext`), **new** `drizzle-orm@^0.45` (runtime) and `drizzle-kit@^0.31` (dev), see
research R1

**Storage**: Cloudflare D1 through the `DB` binding, a local SQLite file under `.wrangler/state/` in
development and `.wrangler/test-state/` in tests. Eleven tables plus two triggers, see
[data-model.md](data-model.md)

**Testing**: Vitest 5. The `node` project gets `src/features/**/*.test.ts` for pure domain tests, and
a new `storage` project covers `src/**/*.storage.test.ts` against local D1 (R4). No Playwright test,
because this is a domain-only feature (constitution 2.1.0)

**Target Platform**: a single Cloudflare Worker on the free plan, built with OpenNext

**Project Type**: web application (Next.js App Router acting as BFF); this feature is server-side
domain and persistence only

**Performance Goals**: session view with prefill < 1 s for a 10×10×10×10 program (SC-005); one
exercise's full history < 2 s at 100,000 set logs (SC-006)

**Constraints**: Worker ≤ 3 MiB compressed; D1 free tier; no interactive transactions on D1, so
multi-row writes use `batch` (R5); gate stays fast, with the storage tests adding under 10 s (R4)

**Scale/Scope**: one user, about 5 years of history (~100k set logs, ~2k sessions, ~2k bodyweight
entries); 22 domain rules, 42 functional requirements, about 35 operations
([contract](contracts/fitness-operations.md))

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                            | Assessment                                                                                                                                                                                                                                                                                                 | Result |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **I. Simplicity First**              | Two new dependencies, both required by the constitution's stack (Drizzle). No repository interface, no mocks, no caches or read models, no new service. Pure domain functions are where the testable logic lives (003), not an added layer. `src/features/` is created because it now has a real occupant. | Pass   |
| **II. Server-Mediated Data Access**  | Every new module is `server-only`. The `DB` binding is touched only by `src/lib/server/database.ts`. No client code and no endpoints are added.                                                                                                                                                            | Pass   |
| **III. Session/Identity Separation** | The profile is keyed by the session's `sub`. No Google data is stored. The session mechanism is unchanged.                                                                                                                                                                                                 | Pass   |
| **IV. Free-Tier Hosting**            | D1 free tier is ample (R11). `drizzle-orm` is small, and the Worker size is confirmed with a dry run (quickstart §5).                                                                                                                                                                                      | Pass   |
| **V. Self-Documenting Code**         | No comments in source. No UI, so no markup strings. Refusals are stable codes that later features map to `src/lib/strings/`. Generated migration SQL keeps drizzle's `--> statement-breakpoint` markers, which are tool syntax, not commentary.                                                            | Pass   |
| **Technology Stack (2.1.0)**         | Drizzle comes with the first feature that stores data; schema and migrations are single-sourced in it (R1).                                                                                                                                                                                                | Pass   |
| **Development Workflow (2.1.0)**     | Domain-only feature: the spec's acceptance scenarios become Vitest tests written first and confirmed failing; done when they pass unmodified. Rules are reachable by Vitest by construction (R3).                                                                                                          | Pass   |
| **Incremental Decisions**            | Schema is decided only for what this feature needs. Endpoint design and UI are not touched. The `Result`-code error style is decided here for fitness operations (R3); it becomes a cross-cutting decision only if a second feature adopts it.                                                             | Pass   |

**Post-design re-check (after Phase 1)**: Pass. Nothing in the data model, contract or quickstart
adds a layer, service or dependency beyond the above. The `storage` Vitest project and the
immutability triggers are the only new mechanisms, and each is justified by a success criterion
(SC-003, SC-004, SC-007; FR-033) that pure tests can't reach.

## Project Structure

### Documentation (this feature)

```text
specs/002-fitness-domain-model/
├── spec.md
├── plan.md                         # this file
├── research.md                     # Phase 0
├── data-model.md                   # Phase 1
├── quickstart.md                   # Phase 1
├── contracts/
│   └── fitness-operations.md       # Phase 1: the server-only operation contract
├── checklists/
│   └── requirements.md
└── tasks.md                        # Phase 2, created by /speckit-tasks
```

### Source Code (repository root)

```text
drizzle.config.ts                   # new: dialect sqlite, schema → feature schema, out → migrations/
migrations/
├── 0000_<generated>.sql            # new: tables and indexes, generated by drizzle-kit
├── 0001_set_log_immutability.sql   # new: custom migration, triggers (R6)
└── meta/                           # new: drizzle journal and snapshots (ignored by Wrangler)
                                    # removed: 0001_baseline.sql (R1)
vitest.config.mts                   # node project += src/features/**/*.test.ts; new storage project
vitest.storage-setup.ts             # new: globalSetup, fresh .wrangler/test-state + migrations

src/lib/server/
└── database.ts                     # new: getDatabase(), Database type; only user of the DB binding

src/features/fitness-tracker/
├── domain/                         # pure, no I/O
│   ├── result.ts                   # Result<T, E>
│   ├── values.ts                   # Weight (kg ⇄ g), Target, Reps, Name, LocalDate
│   ├── exercise.ts                 # name key, catalog rules
│   ├── program.ts                  # structure edits, defaults (R10), last-weight clearing, completeness
│   ├── progression.ts              # block completion, advance/complete, start over, activation, clamp (R9)
│   ├── session.ts                  # start/resume/refuse, suggested next workout
│   ├── logging.ts                  # prefill, log-set decision
│   ├── bodyweight.ts               # local date, weigh-in availability
│   ├── history.ts                  # grouping set logs by block across cycles
│   └── *.test.ts                   # node project
└── server/                         # 'server-only'; Drizzle + D1
    ├── schema.ts                   # all eleven tables, indexes, relations
    ├── mapping.ts                  # rows ⇄ domain types (grams ⇄ kg, dates)
    ├── profile.ts
    ├── exercises.ts
    ├── programs.ts
    ├── activation.ts
    ├── training.ts
    ├── history.ts
    ├── bodyweight.ts
    └── *.storage.test.ts           # storage project, real local D1
```

Documentation outside the feature, updated in the same change:

- `docs/architecture/006-domain-persistence.md` (new): Drizzle versions and migration layout, the
  database parameter pattern, `batch` for atomicity, storage tests via `getPlatformProxy`, and
  immutability triggers. Update the Drizzle paragraph in 004 to point to it.
- `docs/architecture/003-development-workflow.md`: the domain-only acceptance path from constitution
  2.1.0, and the `storage` Vitest project.
- `CLAUDE.md`: Project state (Drizzle, `src/features/`, the fitness domain exists) and the testing
  description.
- The `test` and `check` skills: mention the `storage` project and `*.storage.test.ts`.

**Structure Decision**: Single Next.js project. Fitness code goes in the feature folder
`src/features/fitness-tracker/`, its first occupant, matching the route `/fitness-tracker` and the
feature ID in `src/lib/features.ts`. The only shared piece is `src/lib/server/database.ts`, because
every future feature will reach D1 through it. `docs/04-react-and-nextjs.md` says "database access
lives in one server-only module". Read here, that means one module owns the binding, and each
feature's `server/` folder is its data module.

## Implementation order (for /speckit-tasks)

1. **Acceptance tests first** (red): one Vitest test per spec acceptance scenario and per
   `domain-spec.md` scenario, against the contract, confirmed failing for the intended reason.
2. Drizzle, `database.ts`, the schema, migrations, the storage harness and the triggers.
3. Domain values and the catalog, then User Story 1 (program structure).
4. User Stories 2 and 3 together: training, logging and progression share `finishWorkout`.
5. User Story 4: edits against logged history, and the FR-039 re-evaluation.
6. User Story 5: bodyweight.
7. Performance and isolation tests (SC-005 to SC-007), the documentation updates, the gate, and the
   Worker size check.

## Complexity Tracking

No constitution violations to justify.
