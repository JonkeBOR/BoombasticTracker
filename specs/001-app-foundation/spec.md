# Feature Specification: App Foundation with Fitness Tracker Entry

**Feature Branch**: `001-app-foundation`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "read @fitness-tracker-spec_1.md for the spec" — the foundation spec in
`fitness-tracker-spec_1.md`: a personal multi-feature app whose landing page leads into features,
one app-wide Google sign-in with a persistent session, server-only data access, and the fitness
tracker as the first feature.

## Clarifications

### Session 2026-10-01

- Q: When the owner opens the app without a valid session, should it show the app's own sign-in
  screen or go straight to Google's sign-in page? → A: The app shows its own sign-in screen with a
  "Sign in with Google" button; cancellation, errors and refused accounts are reported there.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sign in once and stay signed in (Priority: P1)

The owner opens the app from the iPhone Home Screen for the first time, signs in with their Google
account, and lands on the app's landing page. From then on, opening the app — after a reload,
closing and reopening it, locking the phone, or switching apps — goes straight to the app without
another Google sign-in, until the session genuinely expires.

**Why this priority**: Every feature, present and future, sits behind this. Without it nothing
personal can be stored or shown safely, and an app that asks for a login on every launch is not
usable from the Home Screen.

**Independent Test**: Sign in on a fresh device, then close, reopen, reload and lock/unlock the
app; it opens to the landing page each time with no sign-in prompt. Attempting the same with a
different Google account is refused.

**Acceptance Scenarios**:

1. **Given** the owner has never signed in on this device, **When** they open the app, **Then**
   the app's sign-in screen appears with a "Sign in with Google" button, and after signing in
   with Google they see the landing page.
2. **Given** the owner signed in earlier and the session is still valid, **When** they reopen the
   app from the Home Screen, **Then** the landing page appears without any sign-in prompt.
3. **Given** the owner is signed in, **When** they reload the page, switch apps and return, or
   lock and unlock the phone, **Then** they remain signed in on the page they were viewing.
4. **Given** a Google account other than the owner's, **When** it completes Google sign-in,
   **Then** the app returns to its sign-in screen with a message that the account is not allowed,
   and shows no personal data.
5. **Given** the session has expired, **When** the owner opens the app, **Then** the sign-in
   screen appears and, after signing in again, they return to the app.
6. **Given** no signed-in session, **When** anyone requests any page or data of the app directly,
   **Then** no personal data is returned and page requests are directed to the sign-in screen.

---

### User Story 2 - Choose a feature from the landing page (Priority: P2)

After signing in, the owner sees a landing page listing the app's features — initially one card,
"Fitness Tracker". Selecting it takes them into the fitness tracker, which has its own address in
the app, and they can return to the landing page from there. Moving between the landing page and
the feature never asks them to sign in again.

**Why this priority**: The landing page and the feature-routing pattern are what make this a
multi-feature app rather than a single-purpose tracker, and every later feature reuses them.

**Independent Test**: Signed in, tap "Fitness Tracker" on the landing page, confirm the fitness
tracker area opens at its own address, navigate back, and confirm no sign-in prompt appears at
any point.

**Acceptance Scenarios**:

1. **Given** the owner is signed in, **When** the landing page loads, **Then** it lists every
   available feature, which today is exactly one: "Fitness Tracker".
2. **Given** the landing page, **When** the owner selects "Fitness Tracker", **Then** the fitness
   tracker area opens at its own distinct address.
3. **Given** the owner is in the fitness tracker, **When** they navigate back to the landing page,
   **Then** it appears without a sign-in prompt.
4. **Given** the app is launched from the Home Screen in standalone mode, **When** the owner moves
   between the landing page and the fitness tracker, **Then** the app stays in standalone mode
   throughout.
5. **Given** the owner bookmarks or opens the fitness tracker's address directly while signed in,
   **When** it loads, **Then** the fitness tracker appears without passing through the landing
   page.

---

### User Story 3 - Fitness tracker placeholder and empty baseline migration (Priority: P3)

The fitness tracker exists as its own area of the app with a placeholder page. Behind the app, the
data store is set up with a single baseline migration that creates no tables: it only establishes
that migrations can be applied to the local and deployed data stores. No fitness schema, screens,
server operations or data-access code are part of this feature; the fitness data model is designed
and created in later features.

**Why this priority**: The fitness tracker is the reason the foundation exists, but the foundation
(Stories 1–2) is valuable and testable on its own first, and this feature deliberately stops at a
placeholder page and an empty baseline migration.

**Independent Test**: Signed in, open the fitness tracker and see its placeholder page; apply the
baseline migration to an empty local data store and confirm it is recorded as applied and no
tables were created.

**Acceptance Scenarios**:

1. **Given** the owner is signed in, **When** they open the fitness tracker, **Then** a placeholder
   page identifies the fitness tracker and offers the way back to the landing page.
2. **Given** an empty data store, **When** the baseline migration is applied, **Then** it is
   recorded as applied and the data store contains no application tables.
3. **Given** the baseline migration has already been applied, **When** migrations are applied
   again, **Then** nothing changes and no error occurs.

---

### User Story 4 - Set up and deploy from the README alone (Priority: P3)

The developer, starting from a clean machine, follows the repository README to configure Google
sign-in, set up a local data store, run the app locally, and deploy it to the hosted environment —
without needing knowledge that isn't written down.

**Why this priority**: The app is a personal learning project that will be revisited after gaps;
setup knowledge that lives only in memory is lost.

**Independent Test**: On a clean environment, follow only the README to reach a running local app
with working sign-in and a migrated data store, then a working deployed app.

**Acceptance Scenarios**:

1. **Given** a clean development environment, **When** the developer follows the README, **Then**
   they can sign in to a locally running app whose data store has the baseline migration applied.
2. **Given** the README, **When** the developer follows its deployment steps, **Then** the
   deployed app supports sign-in over a secure connection and its data store has the baseline
   migration applied.
3. **Given** the repository, **When** it is searched for credentials, **Then** no client secret,
   token, key or other credential value is present in it.

---

### Edge Cases

- The owner denies consent or cancels on Google's sign-in page: the app's sign-in screen shows a
  clear message and the "Sign in with Google" button to try again, and grants no access.
- Google sign-in is temporarily unreachable: the app's sign-in screen says sign-in is unavailable
  rather than failing silently or appearing signed in.
- The session expires while the owner is mid-way through using a feature: the next action that
  needs data directs them to sign in, and they return to where they were afterwards.
- The device is offline when the app is opened: the app states it cannot reach the server rather
  than showing a sign-in prompt or an empty data view as if there were no data.
- A non-owner Google account repeatedly tries to sign in: each attempt is refused and no session
  is created.
- The landing page lists only the features that exist; a feature address that does not exist shows
  a not-found page rather than an error.

## Requirements _(mandatory)_

### Functional Requirements

**Sign-in and session (app-wide)**

- **FR-001**: The app MUST require sign-in with a Google account before showing any page or data
  other than its own sign-in screen. Without a valid session, every page MUST lead to that
  screen, which offers a "Sign in with Google" button and is where cancellation, sign-in errors
  and refused accounts are reported. The app MUST NOT send the owner to Google without that
  button being pressed.
- **FR-002**: The app MUST grant access only to the owner's Google account and MUST refuse every
  other account.
- **FR-003**: The app MUST request from Google only the owner's basic identity (who they are and
  their email address), and no access to any other Google data or service.
- **FR-004**: A single sign-in MUST cover the whole app — the landing page and every feature — with
  no per-feature sign-in.
- **FR-005**: Once signed in, the owner MUST remain signed in across page reloads, closing and
  reopening the app, locking and unlocking the device, and switching apps, until the session
  expires.
- **FR-006**: The app session MUST last at least 30 days from sign-in before the owner is asked to
  sign in again.
- **FR-007**: The owner MUST be able to sign out, after which no page or data is available until
  they sign in again.
- **FR-008**: Google credentials and tokens MUST never be sent to, stored on, or readable from the
  owner's device or browser in any form; they MUST stay on the app's server.
- **FR-009**: The only sign-in credential held by the browser MUST be the app's own session
  credential, which page scripts cannot read and which is only ever transmitted over secure
  connections and not attached to requests initiated by other sites.

**Landing page and features**

- **FR-010**: The app MUST show a landing page at its entry address listing every available
  feature; initially the only entry is "Fitness Tracker".
- **FR-011**: Selecting a feature on the landing page MUST open that feature at its own distinct
  address, and each feature MUST offer a way back to the landing page.
- **FR-012**: Adding a new feature MUST require only adding that feature and its landing-page
  entry, with no change to any other feature.
- **FR-013**: The landing page and every feature MUST work when the app is launched from the
  iPhone Home Screen in standalone mode, and navigation between them MUST stay in standalone mode.

**Data store**

- **FR-014**: The repository MUST contain exactly one migration, a baseline that creates no tables.
  This feature MUST NOT define any fitness schema, nor add any screen, server operation or
  data-access code for fitness data; the fitness tracker shows a placeholder page only.
- **FR-015**: The data store MUST be reachable only by the app's own server; the device MUST never
  connect to it directly.
- **FR-016**: Local development MUST use its own data store, separate from the deployed app's data,
  and the same baseline migration MUST apply cleanly to both.

**Setup and hosting**

- **FR-017**: The repository MUST contain a README that takes a developer from a clean environment
  to a running local app and a deployed app, covering Google sign-in configuration (identity only,
  the owner's account as the allowed user, and the return addresses for local and deployed use),
  local data store setup and reset, hosted data store setup, deployment, and every required
  configuration value and secret for each environment with its purpose.
- **FR-018**: No credential value — client secret, token, signing key or similar — MUST be
  committed to the repository.
- **FR-019**: The deployed app MUST be served over a secure connection and run within a free
  hosting tier, as a single deployment serving both the pages and the server.

### Key Entities

- **Owner**: The single person allowed to use the app, identified by their Google account.
- **Session**: The owner's signed-in state with the app; has a start and an expiry, and is what
  keeps the owner signed in between launches.
- **Feature**: A self-contained area of the app with its own address and a landing-page entry;
  the fitness tracker is the first.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: After one sign-in, the owner opens the app from the Home Screen daily for 30 days and
  is never asked to sign in again within that period.
- **SC-002**: Opening the app from the Home Screen with a valid session shows the landing page in
  under 2 seconds on the owner's iPhone.
- **SC-003**: The owner reaches the fitness tracker from a cold app launch in at most one tap after
  the landing page appears.
- **SC-004**: 100% of attempts by a non-owner Google account, and of requests without a session,
  return no personal data.
- **SC-005**: Inspection of the browser's storage, page content and every server response during a
  full sign-in and usage session finds zero Google credentials or tokens.
- **SC-006**: A second, trivial feature can be added with zero changes to the fitness tracker's
  files.
- **SC-007**: Following only the README, a developer reaches a working local app with sign-in and
  a migrated data store, then a working deployment, with no undocumented step.
- **SC-008**: The baseline migration applies on the first attempt to an empty data store both
  locally and in the deployed environment, leaving no application tables in either.

## Assumptions

- The app has exactly one user, the owner; multi-user support and per-user data separation are
  out of scope until they become a real requirement.
- There is no existing fitness data to import; the source spec's one-off Google Sheets migration
  is dropped.
- Entering, editing and viewing fitness data — and any code that reads or writes it — are
  separate later features, as is the fitness data model itself (workouts, sets, exercises,
  bodyweight measurements); this feature delivers only the fitness tracker's placeholder page and
  an empty baseline migration.
- Because the baseline migration creates no tables, the app session cannot depend on a data store
  table in this feature.
- Session lifetime defaults to 30 days, renewed by use; exact renewal behaviour is a planning
  decision.
- Sign-out is included as a basic expectation of any signed-in app, although the source spec does
  not mention it.
- Offline use is out of scope: the app needs a connection to its server, and only has to say so
  clearly when it has none.
- The installable Home Screen app setup already exists for the landing page and is extended to
  cover every feature, not rebuilt.
- No custom domain is required; the hosting provider's default address is acceptable.
- A free Cloudflare account already exists (account ID `2c9deedd46d8135271fef57c6854e55c`, an
  identifier rather than a secret).
- A Google OAuth web client already exists in the Google Cloud project `worksheetproject`, with
  `http://localhost:3000/api/auth/google/callback` registered as its local return address. The
  deployed return address still has to be registered once the deployed address is known. The
  client's credential file is held locally by the developer and MUST NOT be committed; its values
  reach the app only through local and deployed secret configuration.
- The source spec's technology choices — a SQL database instead of Google Sheets, a specific
  hosting platform and runtime, and a specific data-access library — are inputs to
  `/speckit-plan`, not to this specification. They conflict with the current constitution (which
  names Google Sheets as persistence and leaves the hosting provider and data abstraction
  undecided) and require a constitution amendment before planning.
