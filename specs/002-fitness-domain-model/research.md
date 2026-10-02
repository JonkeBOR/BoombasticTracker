# Research: Fitness Tracker Domain Model

Phase 0 of [plan.md](plan.md). Each decision resolves an open question in the Technical Context or a
gap the spec leaves to planning.

## R1. Drizzle versions and how migrations reach Wrangler

**Decision**: Use the stable releases: `drizzle-orm@^0.45` (runtime) and `drizzle-kit@^0.31` (dev).
`drizzle.config.ts` sets `dialect: 'sqlite'`, `schema` to the feature's schema file and `out:
'migrations'`, so `drizzle-kit generate` writes into the same folder Wrangler applies from. Delete
`migrations/0001_baseline.sql` in the same change.

**Rationale**: `drizzle-kit` 0.31 writes flat `NNNN_name.sql` files plus a `meta/` folder.
Wrangler applies every `.sql` file in `migrations_dir` that is not yet recorded in its `d1_migrations`
table, in name order, and ignores subfolders. So drizzle's output works as-is, with no copy step.
004 worried that "current drizzle-kit writes a folder per migration". That is the 1.0 beta line
(`1.0.0-beta.*` dist-tags only), not the stable 0.31 release.

The baseline holds only `SELECT 1;`. Drizzle starts numbering at `0000`, so keeping the baseline
would leave `0000_…` sorting before `0001_baseline.sql`, and the next drizzle file
`0001_…` would share its prefix. Deleting it is safe: remote D1 keeps its row in
`d1_migrations`, which is harmless, and Wrangler never re-applies or complains about a missing file.

**Alternatives considered**:

- _drizzle-kit 1.0 beta_: folder-per-migration layout that Wrangler can't read without a copy
  step. Also a beta.
- _Keep the baseline and set drizzle's `out` to a separate folder, then copy_: two sources of truth
  and a build step, for no benefit.
- _`drizzle-kit push`_: bypasses migration files, so it can't run in the deploy workflow's
  `wrangler d1 migrations apply --remote` step.

**Verify at implementation**: run `wrangler d1 migrations apply onestopshop --local` on a fresh
state directory and confirm the generated files apply cleanly and `meta/` is ignored.

## R2. Reaching D1 at runtime

**Decision**: Add `src/lib/server/database.ts`, the only module that touches the `DB` binding. It
exports `getDatabase()`, which returns `drizzle(getCloudflareContext().env.DB, { schema })`, and the
`Database` type. Every fitness operation takes a `Database` as its first parameter; the calling route
handler or Server Component passes `getDatabase()` in.

**Rationale**: This follows 003 ("take the session as a parameter and keep the `next/headers` call
in a thin adapter at the edge"): code that receives its database can run in Vitest against a real
local D1 (R4), and only the one-line adapter needs the OpenNext runtime. `next dev` already exposes
the binding through `initOpenNextCloudflareForDev()`.

**Alternatives considered**:

- _Each operation calls `getDatabase()` itself_: can't run outside the OpenNext request context,
  so it can't be unit-tested.
- _A repository interface with a fake for tests_: explicitly deferred by the constitution and by 003.

## R3. Where domain logic lives, and the shape of operations

**Decision**: Use a functional core, imperative shell.

- `src/features/fitness-tracker/domain/` holds **pure** TypeScript: value types (Weight, Target,
  BlockNumber, statuses), validation, and the rules as functions over plain data. Examples: what
  finishing a workout does to a cycle, the prefill for a block, whether a program can be activated,
  and how an exercise replacement changes planned sets. It has no I/O, no Drizzle and no dates read
  from the clock (the caller passes `now`).
- `src/features/fitness-tracker/server/` (server-only) holds the Drizzle schema and the
  **operations**. Each operation loads the rows it needs, calls the domain, and writes the result.
  Every write that spans more than one row goes in a single `db.batch([...])`.

Operations return a discriminated union `{ ok: true, value } | { ok: false, error }` for refusals
the user can cause (name taken, workout already finished, already weighed in today…). `error` is a
stable string code; later features map codes to text in `src/lib/strings/`. Unexpected failures
(storage down) throw.

**Rationale**: Rules are tested in microseconds without a database, which the constitution's "if a
rule can only be tested through Playwright it is in the wrong place" asks for. Operations stay thin:
load, decide, write. This is not the deferred "repository abstraction": no interface sits between
the operations and Drizzle, and nothing is mocked. Result codes rather than thrown errors because
FR-042 requires "a reason the calling feature can show", and refusals are expected outcomes, not
exceptions.

**Alternatives considered**:

- _Rules written directly in SQL or in the operations_: only testable against the database, slow
  and opaque.
- _Rich domain classes (aggregates with methods)_: more ceremony than plain types plus functions,
  and harder to map to and from rows.
- _Throwing typed errors_: callers can't see in the type which refusals to handle.

## R4. Testing persistence in Vitest

**Decision**: Add a third Vitest project, `storage` (node environment), for
`src/**/*.storage.test.ts`. A `globalSetup` file deletes `.wrangler/test-state/` and runs
`wrangler d1 migrations apply onestopshop --local --persist-to .wrangler/test-state`. Each storage
test file then opens a real local D1 with Wrangler's `getPlatformProxy({ persist: { path } })` in
`beforeAll` and disposes it in `afterAll`. Tests isolate by creating a **fresh profile** each,
since every row is profile-scoped; no reset between tests is needed.

**Rationale**: It runs the same engine (Miniflare's D1 in `workerd`), the same migrations and the
same `batch` atomicity as production, with no new dependency: `getPlatformProxy` is already exported
by the installed Wrangler 4. This is what makes SC-003, SC-004 and SC-007 testable, which pure
domain tests can't reach. The `storage` project stays inside `scripts/check.ps1`, because
domain-only acceptance under constitution 2.1.0 needs it to gate.

**Alternatives considered**:

- _`@cloudflare/vitest-pool-workers`_: runs tests inside `workerd`, but it pins Vitest major
  versions and adds a dependency; this repository is on Vitest 5.
- _`better-sqlite3` or `node:sqlite` with Drizzle's SQLite driver_: a second driver whose `batch`
  and error behaviour differ from D1, and `better-sqlite3` needs a native build approved in
  `allowScripts`.
- _Only pure-domain tests_: leaves atomicity, immutability and profile isolation unverified.

**Verify at implementation**: the exact `persist.path` that `getPlatformProxy` expects to share
state with `--persist-to` (whether it appends `v3/`), and the startup cost per file. Aim to keep
storage tests in a few files so the gate stays fast. Budget: under 10 s added to `check.ps1`.

## R5. Atomicity on D1

**Decision**: Make every multi-row change one `db.batch([...])`: log set (insert set log + update
last weight), finish workout (finish session + advance, complete or start cycle + close in-progress
sessions), activate, pause, start over, replace exercise, and structural program edits. The decision
is computed before the batch from rows read just before it.

**Rationale**: D1 doesn't offer interactive transactions through the binding. `batch` runs its
statements as one implicit transaction and rolls back on failure, which is exactly FR-029's "both
or neither". Read-then-batch can race between two devices, but this is a single-user app. Unique
indexes (R7) turn the races that matter into a clean refusal instead of corrupt data.

**Alternatives considered**: `BEGIN`/`COMMIT` statements, which D1 rejects; Durable Objects for
serialisation, a paid-tier-shaped service with no present need.

## R6. Making set logs immutable

**Decision**: A hand-written migration (`drizzle-kit generate --custom --name set_log_immutability`)
adds `BEFORE UPDATE` and `BEFORE DELETE` triggers on `set_logs` that `RAISE(ABORT, …)`. Context
columns on `set_logs` carry no foreign keys, so deleting a program never touches them. The one
foreign key is `exercise_id … ON DELETE RESTRICT`.

**Rationale**: FR-033 says "never modified or deleted by any operation". A trigger makes that a
property of the storage, not a convention every future operation has to remember. One small custom
migration is a cheap price.

**Alternatives considered**: application-level discipline only, which a later feature could break
silently.

**Verify at implementation**: that Wrangler's SQL splitter keeps a `CREATE TRIGGER … BEGIN …; END;`
body intact. If it doesn't, keep the trigger body to one statement on one line, or fall back to a
storage test that asserts no operation issues an update or delete on `set_logs`.

## R7. Identity, keys and value storage

**Decision**:

- IDs are `crypto.randomUUID()` text, generated in the operation. They're available in Workers and
  Node, and let a batch insert parent and child rows without reading back generated keys.
- The profile is keyed by the session's `sub` (Google subject), which is stable across email
  changes. It's created with `INSERT … ON CONFLICT DO NOTHING` the first time an operation needs it
  (FR-002).
- Weight is stored as integer **grams** and is a kilogram number at the API (`22.5` ⇄ `22500`). This
  avoids floating-point drift in stored values and in equality checks in tests.
- Instants (performed at, started, finished) are integer epoch milliseconds. A bodyweight entry's
  day is a `YYYY-MM-DD` text column.
- Uniqueness is enforced in storage too: exercise `(profile_id, name_key)`; one active cycle per
  program (partial unique index `WHERE status = 'active'`); one session per `(cycle_id, block_number,
workout_id)`; one bodyweight entry per `(profile_id, entry_date)`.

**Rationale**: Each choice removes a class of bug (key round-trips, float equality, duplicates under
races) with no added machinery.

## R8. The user's time zone

**Decision**: Operations that depend on "today" (bodyweight, cycle start and end dates) take an IANA
`timeZone` argument from the caller (later features read it from the device with
`Intl.DateTimeFormat().resolvedOptions().timeZone`). The domain derives the local date with
`Intl.DateTimeFormat('en-CA', { timeZone })`. An unknown zone is refused as `invalid-time-zone`.

**Rationale**: It matches the spec's assumption ("as reported by their device at the time of the
action") without storing a profile setting nobody asked for. `Intl` with full ICU is available in
Workers and Node.

**Alternatives considered**: storing a time zone on the profile, which is a settings feature with
no present need; using UTC dates, which breaks rule 21 for an evening weigh-in in Sweden.

## R9. Block identity under edits

**Decision**: Prescriptions and planned sets belong to a **training block row**. Cycles and sessions
refer to a **block number** (position 1…N), because the domain's progression is positional ("move
to the next block"). Set logs record both the block number and the training block ID.

- Reordering blocks moves prescriptions and their last weights with the block. The cycle's current
  block number stays the same, so from then on it points at whichever block now holds that position.
- Removing blocks so the current number exceeds N moves the cycle's current block to N (spec edge
  case).
- After any edit that changes workouts or blocks, the operation re-runs the domain's "evaluate
  progression" for the active cycle (FR-039).

**Rationale**: Positional progression is what the domain describes and is simplest to reason about.
Recording the block ID on set logs keeps "same block across cycles" correct even if blocks are
reordered between cycles (FR-035).

## R10. Defaults the program builder will need

Planning these now keeps the domain total. Each is a small, documented choice the program-builder
feature can revisit.

- **New program**: the caller gives a name and a block count of at least 1. It is created with that
  many unlabeled blocks and no workouts.
- **Adding a block**: appended at the end. Each slot gets a copy of the **last block's** targets with
  empty last weight (rule 19). This keeps the program activatable.
- **Adding a slot**: the caller supplies one list of target reps, applied to every block, all with
  empty last weight.
- **Setting a prescription**: the caller replaces a slot's target list for one block. Planned sets
  whose set number still exists keep their last weight, including when their target changes. New
  set numbers start empty, and removed ones are dropped (spec edge cases).
- **Removing the last remaining block** is refused (`program-needs-a-block`).

## R11. Performance budget

**Decision**: There are no caches and no denormalised read models. The session view for SC-005 is
three indexed reads (session, slots joined to exercises, planned sets for the block). Exercise
history for SC-006 reads `set_logs` through an index on `(profile_id, exercise_id, performed_at)`.
A storage test seeds the SC-005 program shape (10×10×10×10) and 100,000 set logs and asserts the
time budgets locally.

**Rationale**: At this scale, SQLite with the right indexes is orders of magnitude inside the
budgets, and D1's free tier (5 M rows read per day) is far beyond one person's use.

## Inherited, not re-decided

- Sign-in, session and the `requireSession` pattern: 004.
- Two test loops and the gate: 002, 003 and constitution 2.1.0 (domain-only acceptance in Vitest).
- Worker size limit of 3 MiB compressed on the free plan: 004. `drizzle-orm` is small; confirm with
  `npx wrangler deploy --dry-run` after adding it.
