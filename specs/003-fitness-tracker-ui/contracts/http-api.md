# Contract: Fitness HTTP API (BFF)

The browser's only way to change fitness data. Reads are not part of this API: pages read through Server
Components (research R1). Every endpoint is a `route.ts` under `src/app/api/fitness/`, wrapped by
`fitnessRoute` (research R2).

## Conventions

- **Auth**: the application session cookie. Without a valid session: `401 { "error": "unauthorized" }`.
- **Body**: JSON. Requests whose body doesn't have the listed shape: `400 { "error": "invalid-body" }`.
- **Success**: `200` with the JSON shown. Dates are ISO strings, weights are kg numbers.
- **Refusal**: `{ "error": code }`:
  - `404` for `not-found`, including another profile's IDs.
  - `400` for input codes: `invalid-body`, `name-required`, `name-too-long`, `invalid-weight`,
    `invalid-reps`, `invalid-target`, `invalid-block-count`, `invalid-time-zone`, `invalid-position`,
    `invalid-block` and `prescription-needs-a-set`.
  - `409` for every other refusal.
- **Infrastructure failure**: `500 { "error": "unexpected" }`, with no provider message.
- **Time**: `now` is taken by the server. Only bodyweight takes the device's `timeZone`.
- `FitnessErrorCode` is the union of every code below, plus `unauthorized`, `invalid-body` and `unexpected`.
  Each has text in `fitnessErrorStrings`.

## Bodyweight

| Method | Path                      | Body                                     | 200                      | Refusals                                                          |
| ------ | ------------------------- | ---------------------------------------- | ------------------------ | ----------------------------------------------------------------- |
| POST   | `/api/fitness/bodyweight` | `{ weightKg: number, timeZone: string }` | `{ id, date, weightKg }` | `invalid-weight`, `invalid-time-zone`, `already-weighed-in-today` |

## Exercises

| Method | Path                          | Body                           | 200        | Refusals                                       |
| ------ | ----------------------------- | ------------------------------ | ---------- | ---------------------------------------------- |
| POST   | `/api/fitness/exercises`      | `{ name }`                     | `Exercise` | `name-required`, `name-too-long`, `name-taken` |
| PATCH  | `/api/fitness/exercises/[id]` | `{ name }` or `{ isArchived }` | `Exercise` | as above, `not-found`                          |
| DELETE | `/api/fitness/exercises/[id]` | —                              | `{}`       | `not-found`, `exercise-in-use`                 |

## Programs and their structure

| Method | Path                                              | Body                                                     | 200      | Refusals                                                                                                      |
| ------ | ------------------------------------------------- | -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/fitness/programs`                           | `{ name, blockCount }`                                   | `{ id }` | `name-*`, `invalid-block-count`                                                                               |
| PATCH  | `/api/fitness/programs/[id]`                      | `{ name }`                                               | `{}`     | `name-*`, `not-found`                                                                                         |
| DELETE | `/api/fitness/programs/[id]`                      | —                                                        | `{}`     | `not-found`, `program-active`                                                                                 |
| POST   | `/api/fitness/programs/[id]/blocks`               | `{}`                                                     | `{}`     | `not-found`                                                                                                   |
| PATCH  | `/api/fitness/blocks/[id]`                        | `{ label: string \| null }`                              | `{}`     | `not-found`                                                                                                   |
| DELETE | `/api/fitness/blocks/[id]`                        | —                                                        | `{}`     | `not-found`, `program-needs-a-block`                                                                          |
| POST   | `/api/fitness/programs/[id]/workouts`             | `{ name }`                                               | `{ id }` | `name-*`, `not-found`                                                                                         |
| PATCH  | `/api/fitness/workouts/[id]`                      | `{ name }` or `{ toPosition }`                           | `{}`     | `name-*`, `invalid-position`, `not-found`                                                                     |
| DELETE | `/api/fitness/workouts/[id]`                      | —                                                        | `{}`     | `not-found`                                                                                                   |
| POST   | `/api/fitness/workouts/[id]/slots`                | `{ exerciseId, sets, reps }`                             | `{ id }` | `not-found`, `exercise-archived`, `exercise-already-in-workout`, `prescription-needs-a-set`, `invalid-target` |
| PATCH  | `/api/fitness/slots/[id]`                         | `{ exerciseId }` or `{ isOptional }` or `{ toPosition }` | `{}`     | `not-found`, `exercise-archived`, `exercise-already-in-workout`, `invalid-position`                           |
| DELETE | `/api/fitness/slots/[id]`                         | —                                                        | `{}`     | `not-found`                                                                                                   |
| PUT    | `/api/fitness/slots/[id]/prescriptions/[blockId]` | `{ targetReps: number[] }`                               | `{}`     | `not-found`, `prescription-needs-a-set`, `invalid-target`                                                     |

- **`program-active`** is checked by the handler: the screen never offers Delete for the active program
  (FR-033), and the handler refuses it too, so an old page can't do it either. The domain's
  `deleteProgram` is unchanged.
- **Slot creation** sends `sets` and `reps` from the form. The handler expands them to
  `targetReps = Array(sets).fill(reps)` and passes the result to `addExerciseSlot`. `sets` must be a whole
  number ≥ 1, or `prescription-needs-a-set` is returned.
- **Quick fill, copy from previous block, add set, remove last set and changing one target** are all one
  call to the prescriptions endpoint with the full new `targetReps` list. The screen builds the list. The
  domain keeps last weights by set number (spec R1).

## Activation and progression

| Method | Path                                    | Body          | 200                    | Refusals                             |
| ------ | --------------------------------------- | ------------- | ---------------------- | ------------------------------------ |
| POST   | `/api/fitness/programs/[id]/activation` | `{}`          | `{}`                   | `not-found`, `program-incomplete`    |
| DELETE | `/api/fitness/active-program`           | —             | `{}`                   | `no-active-program`                  |
| POST   | `/api/fitness/active-program/skip`      | `{ blockId }` | `{ newPass: boolean }` | `no-active-program`, `invalid-block` |

## Training

| Method | Path                                 | Body                                                       | 200                                                                                    | Refusals                                                                                                                     |
| ------ | ------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/fitness/workouts/[id]/session` | `{}`                                                       | `{ sessionId }` (new or resumed)                                                       | `no-active-program`, `workout-not-in-active-program`, `workout-already-finished`                                             |
| POST   | `/api/fitness/sessions/[id]/sets`    | `{ plannedSetId, reps: number, weightKg: number \| null }` | `SetLog`                                                                               | `not-found`, `session-not-in-progress`, `planned-set-not-in-session`, `set-already-logged`, `invalid-reps`, `invalid-weight` |
| POST   | `/api/fitness/sessions/[id]/finish`  | `{}`                                                       | `{ progression: 'none' \| 'block-advanced' \| 'new-pass', completedBlockNumber: number | null }`                                                                                                                      | `not-found`, `session-not-in-progress` |

- **`set-already-logged`** is checked by the handler before `logSet` (research R9).
- **On `409 session-not-in-progress` and `409 set-already-logged`**, the session screen shows the message
  and calls `router.refresh()` (the spec's stale-view edge case).
- **After finishing**, the client navigates to `/fitness-tracker/active/block?completed=<completedBlockNumber>`
  when `progression` isn't `none`. Otherwise it navigates to `/fitness-tracker/active/block`.

## Testing

Each handler gets storage tests that call the exported `handle…` function with a real local D1 and a fresh
profile. They assert the status code and the body for success and for each listed refusal. The 401 path is
covered once, by a node-project test of the session check.
