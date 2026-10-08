# 007 — The cycle as a container, and the fitness BFF

**Status**: accepted
**Date**: 2026-10-03

## Context

The fitness tracker UI (feature 003) put the first screens on the fitness domain. Two things in the domain
as built by 006 did not survive contact with a phone UI:

- A **cycle** was one row per pass through a program, with a number, a status and start and end
  dates. The UI has no use for that history. It needs one answer, "where am I in this program?", and
  the history lives in the set logs anyway.
- Sessions and the cycle referred to blocks by **position** (`block_number`). Removing a block in
  the middle of a pass shifted every later block down, so a session silently belonged to a different
  block, and the user was moved on without doing anything.

The UI also needed a way to write data, which 002 deliberately left open.

## Decision

### The cycle is a container

Each program has exactly one cycle for its whole life, created in the same batch as the program. It
holds `current_block_id` and `pass`. It has no number, status or dates, and it is never shown to the
user. A **pass** is one run through the blocks from block 1. A new pass increments the counter and
returns to the first block. It starts when the last block is finished, when the user skips to block
1, or when the current block is removed and it was the last.

Each session records the pass it belongs to. Only sessions of the current pass count towards block
completion, workout status and the suggested workout, so nothing is deleted when a pass ends and
nothing from an earlier pass counts. Set logs keep their `cycle_number` column; it is read as `pass`
in TypeScript, which is the same number for old rows.

Pausing a program, or activating another one, keeps its place. Both close the program's in-progress
sessions as finished.

### Blocks are referred to by identity

`cycles.current_block_id` and `workout_sessions.training_block_id` hold block IDs. "Next block" means
the next one by position, computed when needed. Removing an earlier block therefore leaves the user
on the same block. Removing the current block moves to the one that followed it, with none of its
workouts finished. Sessions of a removed block stop counting and are never deleted.

### One skip operation

`skipToBlock` replaces `startOver` and `listCycles`. A later block moves forward within the pass.
The first block starts a new pass. The current block and any earlier block but the first are refused.

### The migration has three files

SQLite cannot make a column `NOT NULL` or drop an indexed column in place, and 006 forbids editing
generated SQL, so the change is a generated additive migration (`0002`), a custom data migration
(`0003`) and a generated rebuild (`0004`). `0003` keeps one cycle per program (the active one, or
else the latest), moves every session onto it, and fills the new columns. It drops the old session
index first, because collapsing cycles would otherwise violate it. `set_logs` is untouched, so its
immutability triggers are never dropped. `cycle-migration.storage.test.ts` builds the old shape with
raw SQL and checks the outcome.

### The BFF

Reads happen in Server Components, which call the server-only operations directly. Writes go through
JSON route handlers under `/api/fitness/`. Each handler is a plain function over a
`FitnessRequestContext`, wrapped by `fitnessRoute`, which checks the session, opens the database and
resolves the profile. A refusal is `{ "error": code }` with a status derived from the code: 404 for
`not-found`, 400 for invalid input, 409 for everything else. The browser maps codes to text through
`fitnessErrorStrings`, a `Record` over every code, so a code without text fails the typecheck.

Server Actions would need less code, because they have no JSON parsing or route files. They were not
adopted, because `docs/04-react-and-nextjs.md` already says client components fetch through `/api/*`,
and changing that is a project-wide decision, not a feature's. It is open for later.

### Small decisions

- **Time zone.** A small client component keeps a `tz` cookie current, so Server Components can say
  whether a weigh-in is available today. The weigh-in request also carries the zone, so the write never
  depends on the cookie.
- **Confirmations** use the native `<dialog>`; there is no modal library.
- **Typed set values** are mirrored to `localStorage` through an external store, so they survive
  leaving the session view and work during hydration. The store keeps the values in memory too, because
  storage can be unavailable.
- **Logging a planned set twice** is still allowed by the domain. The handler refuses it
  (`set-already-logged`) by looking at the session first, which keeps 002's contract intact.

## Consequences

- The cycle history of 002 (numbers, statuses, dates, `listCycles`) is gone. Past passes can still be
  reconstructed from set logs and sessions if a progress view needs them.
- Spec 002's tests for rules 2 to 9 and 13 were rewritten to the new transitions, with the rule number
  kept in each title.
- The migration was applied locally and tested on realistic data, and it runs against the remote
  database when this branch merges. Read the generated SQL of `0002` and `0004` before merging.
- Each program's single cycle is keyed by `program_id`, so a future second cycle per program (for
  example, per profile) would need a new key.
- The Worker grew from 1,103 KiB to 1,350 KiB gzipped (`wrangler deploy --dry-run`). The free plan
  limits only the uncompressed size, to 64 MiB; see 004 for the limits that matter.
