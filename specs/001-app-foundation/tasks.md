---
description: 'Task list for the app foundation feature'
---

# Tasks: App Foundation with Fitness Tracker Entry

**Input**: Design documents from `specs/001-app-foundation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/http.md](contracts/http.md),
[contracts/configuration.md](contracts/configuration.md), [quickstart.md](quickstart.md)

**Tests**: Required. The constitution's Development Workflow makes this test-driven, following
`docs/architecture/003-development-workflow.md`:

- **Outer loop**: one Playwright acceptance spec, written first and confirmed red (T008).
- **Inner loop**: Vitest red-green-refactor. Every `*.test.ts(x)` task MUST be written and seen
  failing before its implementation task.
- **Exempt**: styling and layout are not test-driven.

**Rules that apply to every code task** (repo guidelines, enforced by `scripts/check.ps1`):

- No comments.
- No inline styles; styles go in a CSS Module beside the code, using the tokens in
  `src/app/globals.css`.
- No bare strings in JSX: text comes from `src/lib/strings/*`.
- Imports use the `@/*` alias.
- Server-only modules start with `import 'server-only';`.
- Exported async functions declare return types.
- `searchParams` is a `Promise` in Next 16 and must be awaited.
- Finish each phase with `pwsh -NoProfile -File scripts/check.ps1` exiting 0.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, Cloudflare/OpenNext wiring, test configuration and local secrets.

- [x] T001 Install dependencies, updating `package.json` and `package-lock.json`:
  - `npm install arctic jose server-only`
  - `npm install -D @opennextjs/cloudflare wrangler`
- [x] T002 [P] Create `wrangler.jsonc` per [contracts/configuration.md](contracts/configuration.md):
  - `name: "onestopshop"` and `account_id: "2c9deedd46d8135271fef57c6854e55c"`
  - `main: ".open-next/worker.js"`, and `compatibility_date` set to today (`"2026-10-01"`)
  - `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`
  - `assets: { "directory": ".open-next/assets", "binding": "ASSETS" }`
  - `services: [{ "binding": "WORKER_SELF_REFERENCE", "service": "onestopshop" }]`
  - `vars: { "GOOGLE_CLIENT_ID": "<client_id from the downloaded client JSON>", "OWNER_EMAIL":
"<owner's Google email, ask the developer>" }`

  Do **not** add `d1_databases` yet (T037), and do not add an R2 incremental cache (research R1).

- [x] T003 [P] Update `next.config.ts`: after `export default nextConfig;`, import
      `initOpenNextCloudflareForDev` from `@opennextjs/cloudflare` and call it, per research R1.
- [x] T004 [P] Add scripts to `package.json`:
  - `"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"`
  - `"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"`

  Leave the existing scripts unchanged.

- [x] T005 [P] Add a `.dev.vars` line to `.gitignore` under a `# Cloudflare local secrets`
      heading. `.env*.local`, `.wrangler/`, `.open-next/` and `client_secret_*.json` are already
      ignored, so don't duplicate them.
- [x] T006 [P] Update `vitest.config.mts`:
  - Alias `server-only` to `node_modules/server-only/empty.js`, so server modules import cleanly
    in tests.
  - Define two `test.projects`: `node`, with environment `node` and include
    `src/lib/**/*.test.ts` and `src/app/api/**/*.test.ts`; and `dom`, with environment `jsdom`
    and include `src/**/*.test.tsx`.

  The `node` environment is needed because `jose` rejects jsdom's cross-realm `Uint8Array`.

- [x] T007 Create the developer's local secrets (never committed):
  - `.env.local` and an identical `.dev.vars`, containing `GOOGLE_CLIENT_ID` and
    `GOOGLE_CLIENT_SECRET` (from
    `client_secret_598266239301-g3q2rnvvqg31kldgulglp3fp80gkmi6i.apps.googleusercontent.com.json`
    in the repo root), `OWNER_EMAIL` (ask the developer), and `SESSION_SECRET`.
  - Generate `SESSION_SECRET` with
    `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
  - Confirm `git status` shows neither file. Then confirm `npm run dev` starts and `/` still
    renders, and `scripts/check.ps1` exits 0.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The failing acceptance spec, plus the session, return-path and config modules that
every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Write the acceptance spec first and confirm it fails for the intended reasons.
  - Create `e2e/app-foundation.spec.ts` with one `test.describe` per story:
    - **US1 sign-in**:
      - Signed out, `/` and `/fitness-tracker` show a "Sign in with Google" link whose `href`
        starts with `/api/auth/google`.
      - `/sign-in?error=cancelled|not-allowed|expired|unavailable` each show their
        `authStrings` message.
      - Signed in, `/sign-in` redirects to `/`.
      - "Sign out" returns to the sign-in screen, after which `/` shows the sign-in screen again.
    - **US2 features**:
      - Signed in, `/` lists exactly one feature card, "Fitness Tracker".
      - Tapping it opens `/fitness-tracker`, and its back link returns to `/`.
      - Opening `/fitness-tracker` directly works.
      - `/no-such-feature` returns 404.
    - **US3 placeholder**: signed in, `/fitness-tracker` shows the placeholder heading.
  - Create `e2e/session.ts`, exporting `signIn(context: BrowserContext): Promise<void>`. It
    loads `.env.local` with `loadEnvConfig` from `@next/env`, mints a token with
    `signSessionToken` from `@/lib/session-token`, and calls `context.addCookies` for cookie
    `session` on `http://localhost:3000`.
  - Delete `e2e/home.spec.ts`, which is superseded.
  - Run `pwsh -NoProfile -File scripts/e2e.ps1`. Expect every test red because the routes,
    strings or modules don't exist yet. Do not edit this spec again until the end of the feature
    (ADR 003).
- [x] T009 [P] Write `src/lib/session-token.test.ts` (Vitest, node project). The secret is a
      32-byte base64 string generated in the test.
  - `signSessionToken({ sub, email }, secret, now)` then `verifySessionToken(token, secret, now)`
    returns `{ sub, email }`.
  - `exp` equals `iat + 7776000` (90 days).
  - It returns `null` when:
    - `now` is past `exp`
    - the token's payload or signature is altered
    - the secret is different
    - the token is signed with HS512 or carries `alg: none`
    - the token is an empty string or `undefined`
- [x] T010 [P] Write `src/lib/return-to.test.ts`.
  - `safeReturnTo(value)` returns `value` for `/` and `/fitness-tracker?x=1`.
  - It returns `/` for:
    - `undefined`, `''`, `null`
    - `//evil.com`, `/\evil.com`
    - `https://evil.com`, `evil`
    - `javascript:alert(1)`
- [x] T011 [P] Write `src/lib/server/config.test.ts`. `readConfig(env)` takes a record (in
      production `process.env`) and:
  - returns the four values `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` and
    `OWNER_EMAIL`, with `OWNER_EMAIL` trimmed and lower-cased;
  - throws an `Error` whose message names every missing or empty variable and contains no
    variable values.
- [x] T012 Implement `src/lib/session-token.ts` until T009 passes.
  - Use `jose` `SignJWT` / `jwtVerify` with `algorithms: ['HS256']`, a key decoded from the
    base64 secret, and `currentDate: now`. Claims are `sub`, `email`, `iat` and `exp`, per
    [data-model.md](data-model.md#session-cookie-session).
  - Export `sessionLifetimeSeconds = 7776000`.
  - Do not import `server-only`: the e2e helper imports this module, and it holds no secret of
    its own.
- [x] T013 [P] Implement `src/lib/return-to.ts` until T010 passes. Accept only strings starting
      with a single `/` whose second character is neither `/` nor `\`.
- [x] T014 [P] Implement `src/lib/server/config.ts` until T011 passes.
  - Also export `getConfig()`, which calls `readConfig(process.env)`.
  - Start the file with `import 'server-only';`.
- [x] T015 Write `src/lib/server/session-cookie.test.ts`, then implement
      `src/lib/server/session-cookie.ts`.
  - Export cookie names: `sessionCookieName = 'session'`, `oauthStateCookieName = 'oauth_state'`,
    `oauthVerifierCookieName = 'oauth_code_verifier'` and
    `oauthReturnToCookieName = 'oauth_return_to'`.
  - Export `cookieAttributes(requestUrl: URL, maxAgeSeconds: number)`. It returns `httpOnly:
true`, `sameSite: 'lax'`, `path: '/'`, `maxAge`, and `secure: requestUrl.protocol ===
'https:'` (research R5). Unit-test both the HTTP and HTTPS cases.
  - Export `getSession()`, wrapped in React `cache`. It reads `session` via
    `await cookies()` and calls `verifySessionToken` with `getConfig().sessionSecret` and
    `new Date()`.
  - Export `requireSession(returnPath: string): Promise<SessionClaims>`. With no session it
    calls `redirect('/sign-in?returnTo=' + encodeURIComponent(returnPath))`.
  - Only `cookieAttributes` is unit-tested. `getSession` and `requireSession` are the thin
    `next/headers` adapter that the acceptance spec covers (ADR 003).
  - Start the file with `import 'server-only';`.

**Checkpoint**: `scripts/check.ps1` exits 0, and the acceptance spec is still red.

---

## Phase 3: User Story 1 - Sign in once and stay signed in (Priority: P1) 🎯 MVP

**Goal**: The owner signs in with Google from the app's own sign-in screen and stays signed in for
90 days. Other accounts are refused. Every page is protected, and sign-out works.

**Independent Test**: Run the US1 acceptance group, then follow quickstart §4 with a real Google
account at `http://localhost:3000`.

### Tests for User Story 1 ⚠️ write first, see them fail

- [x] T016 [P] [US1] Write `src/lib/server/google-sign-in.test.ts` with a fake OAuth client
      (`createAuthorizationURL`, `validateAuthorizationCode`) and a fixed `now`.
  - **`isOwner(claims, ownerEmail)`**: true only when `email_verified === true` and the email
    matches case-insensitively.
  - **`startSignIn(request, client)`** returns a `302` whose `Location` contains
    `scope=openid+email+profile` (or `%20`-separated), `code_challenge_method=S256` and `state`.
    It sets `oauth_state`, `oauth_code_verifier` and `oauth_return_to`, each with `Max-Age=600`
    and `HttpOnly`. `oauth_return_to` holds `safeReturnTo(returnTo)`, so `?returnTo=//evil.com`
    stores `/`. The redirect URI passed to the client is `<request origin>/api/auth/google/callback`.
  - **`completeSignIn(request, client, config, now)`**: one test per row of the callback table in
    [contracts/http.md](contracts/http.md#get-apiauthgooglecallback), in order:
    - `error=access_denied` → `/sign-in?error=cancelled`
    - any other `error` → `unavailable`
    - missing or mismatched state, or missing verifier → `expired`
    - the client throws → `unavailable`
    - not the owner → `not-allowed`, with no `session` cookie
    - success → a `session` cookie (`Max-Age=7776000`) and `Location` = `oauth_return_to`
  - Every outcome clears the three `oauth_*` cookies.
  - No `Location` header or body contains the code, an ID token or an access token.
- [x] T017 [P] [US1] Write `src/app/api/auth/sign-out/route.test.ts`. `POST` returns `303` with
      `Location` `/sign-in` and a `Set-Cookie` that expires `session`, with or without an incoming
      session.
- [x] T018 [P] [US1] Write `src/app/sign-in/SignInScreen.test.tsx`. `SignInScreen` (props
      `returnTo: string`, `error: SignInError | undefined`):
  - renders an `h1`, and a link with the `authStrings.signInWithGoogle` name whose `href` is
    `/api/auth/google?returnTo=<encoded returnTo>`;
  - renders the `authStrings` message for each `SignInError`, and no message when `error` is
    `undefined`.
- [x] T019 [P] [US1] Write `src/lib/sign-in-error.test.ts`. `parseSignInError(value)` returns
      `'cancelled' | 'not-allowed' | 'expired' | 'unavailable'` for those exact strings and
      `undefined` for anything else.

### Implementation for User Story 1

- [x] T020 [P] [US1] Create `src/lib/strings/auth.ts`, exporting `authStrings` `as const`:
  - `signInTitle`, `signInIntro`, `signInWithGoogle` ("Sign in with Google"), `signOut`
    ("Sign out")
  - `errors`: `cancelled` (sign-in cancelled, try again), `notAllowed` (this Google account is
    not allowed), `expired` (sign-in took too long, try again) and `unavailable` (Google sign-in
    is unavailable right now, try again later)
- [x] T021 [P] [US1] Implement `src/lib/sign-in-error.ts` until T019 passes. It exports
      `type SignInError`.
- [x] T022 [US1] Implement `src/lib/server/google-sign-in.ts` until T016 passes.
  - Export `createGoogleClient(config, redirectUri)`, which returns `new arctic.Google(clientId,
clientSecret, redirectUri)`.
  - Export `isOwner`, `startSignIn` and `completeSignIn`.
    - Use `arctic.generateState()` and `arctic.generateCodeVerifier()`.
    - Use `arctic.decodeIdToken()` on `tokens.idToken()`.
    - On success, call `signSessionToken({ sub, email })`.
    - Set cookies through `cookieAttributes` from `session-cookie.ts`, and return a `Response`.
  - Discard the Google access and refresh tokens; never store or return them (research R3/R4).
  - Start the file with `import 'server-only';`.
- [x] T023 [US1] Create `src/app/api/auth/google/route.ts`. `export async function GET(request:
Request): Promise<Response>` builds the client with `getConfig()` and the redirect URI
      `new URL('/api/auth/google/callback', request.url)`, then returns `startSignIn(request,
client)`. Keep it thin, with no logic.
- [x] T024 [US1] Create `src/app/api/auth/google/callback/route.ts`. `GET` wires `getConfig()`,
      `createGoogleClient` and `new Date()` into `completeSignIn`. Keep it thin.
- [x] T025 [US1] Implement `src/app/api/auth/sign-out/route.ts` until T017 passes. Export only
      `POST`; Next answers other methods with 405. It returns `303` → `/sign-in`, and expires
      `session` with `cookieAttributes(new URL(request.url), 0)`.
- [x] T026 [US1] Implement `src/app/sign-in/SignInScreen.tsx` until T018 passes, styled in
      `src/app/sign-in/SignInScreen.module.css`.
  - Reuse the safe-area padding pattern from `src/app/page.module.css`.
  - Make the button-styled link a full-width tap target of at least `2.75rem` height.
  - Show the error message in a `role="alert"` element.
- [x] T027 [US1] Create `src/app/sign-in/page.tsx` as an async Server Component.
  - Await `searchParams`, and compute `returnTo = safeReturnTo(searchParams.returnTo)` and
    `error = parseSignInError(searchParams.error)`.
  - If `await getSession()` returns a session, `redirect(returnTo)`.
  - Otherwise render `<SignInScreen returnTo={returnTo} error={error} />`.
- [x] T028 [US1] Protect the landing page.
  - Move the current markup of `src/app/page.tsx` into a synchronous presentational
    `src/app/LandingScreen.tsx`. Keep its `h1` with `appStrings.name` and the description, and
    add a `<form method="post" action="/api/auth/sign-out">` with a `button` labelled
    `authStrings.signOut`.
  - `page.tsx` becomes `export default async function LandingPage()`. It calls
    `await requireSession('/')` and renders `<LandingScreen />`.
  - Move `src/app/page.test.tsx` to `src/app/LandingScreen.test.tsx`, test `LandingScreen`, and
    add an assertion for the sign-out button.
  - Move the styles to `src/app/LandingScreen.module.css` and delete `src/app/page.module.css`.
- [ ] T029 [US1] Run the US1 group of `e2e/app-foundation.spec.ts` (green), then quickstart §4
      steps 1–4 by hand with a real Google account:
  - owner sign-in persists across reload and reopen;
  - only an `HttpOnly` `session` cookie is present, with no Google token anywhere;
  - another account gets "not allowed";
  - Cancel gets "cancelled".

**Checkpoint**: User Story 1 is fully functional. This is the MVP.

---

## Phase 4: User Story 2 - Choose a feature from the landing page (Priority: P2)

**Goal**: The landing page lists features from a registry. The fitness tracker opens at its own
protected address and links back.

**Independent Test**: Run the US2 group of the acceptance spec, then quickstart §8 (adding a
feature touches no fitness-tracker file).

### Tests for User Story 2 ⚠️ write first, see them fail

- [x] T030 [P] [US2] Write `src/lib/features.test.ts`.
  - `features` has exactly one entry: `id` `'fitness-tracker'`, `path` `'/fitness-tracker'`,
    `title` `featureStrings.fitnessTracker.title`.
  - All ids are unique and every `path` starts with `/`.
- [x] T031 [P] [US2] Extend `src/app/LandingScreen.test.tsx`. `LandingScreen` (prop `features:
readonly Feature[]`) renders one link per feature, named by its title, with `href` equal to its
      `path`. Two fake features render two links.
- [x] T032 [P] [US2] Write `src/app/fitness-tracker/FitnessTrackerScreen.test.tsx`. It renders an
      `h1` with `featureStrings.fitnessTracker.title`, the placeholder text
      `featureStrings.fitnessTracker.placeholder`, and a link named `featureStrings.backToFeatures`
      with `href="/"`.

### Implementation for User Story 2

- [x] T033 [P] [US2] Create `src/lib/strings/features.ts`, exporting `featureStrings` `as const`:
  - `heading` ("Your tools")
  - `backToFeatures` ("All tools")
  - `fitnessTracker`: `title` ("Fitness Tracker"), `description` (one sentence about workouts
    and bodyweight) and `placeholder` (says tracking arrives soon)
- [x] T034 [US2] Implement `src/lib/features.ts` until T030 passes. Export `type Feature = { id:
string; path: string; title: string; description: string }` and `export const features:
readonly Feature[]` with the single fitness-tracker entry.
- [x] T035 [US2] Extend `src/app/LandingScreen.tsx` until T031 passes.
  - Render a `featureStrings.heading` `h2` and a list of `next/link` cards showing title and
    description. Style them in `src/app/LandingScreen.module.css` as full-width cards with tap
    targets of at least `2.75rem`.
  - `src/app/page.tsx` passes `features` from `@/lib/features`.
- [x] T036 [US2] Create the fitness tracker route.
  - `src/app/fitness-tracker/FitnessTrackerScreen.tsx` is presentational and passes T032. Style
    it in `src/app/fitness-tracker/FitnessTrackerScreen.module.css` with the safe-area padding
    pattern.
  - `src/app/fitness-tracker/page.tsx` is an async page: `await requireSession('/fitness-tracker')`,
    then `<FitnessTrackerScreen />`.
  - Run the US2 and US3-placeholder groups of the acceptance spec and expect them green.

**Checkpoint**: User Stories 1 and 2 both work. The fitness tracker placeholder (US3 scenario 1)
is delivered here, because it is the navigation target.

---

## Phase 5: User Story 3 - Fitness tracker placeholder and empty baseline migration (Priority: P3)

**Goal**: A D1 database is bound to the Worker, and a single baseline migration that creates no
tables applies cleanly, locally and remotely.

**Independent Test**: Run quickstart §2: apply twice, list tables, and see only Wrangler's
`d1_migrations`.

- [x] T037 [US3] Developer action (interactive, needs the Cloudflare login):
  - Run `npx wrangler login` and confirm account `2c9deedd46d8135271fef57c6854e55c`.
  - Run `npx wrangler d1 create onestopshop`.
  - Add the printed block to `wrangler.jsonc` as `d1_databases: [{ "binding": "DB",
"database_name": "onestopshop", "database_id": "<printed id>", "migrations_dir":
"migrations" }]`.
- [x] T038 [US3] Create the baseline migration.
  - Run `npx wrangler d1 migrations create onestopshop baseline`, which creates
    `migrations/0001_baseline.sql`.
  - Set its entire content to `SELECT 1;`, a single no-op statement with no comment, because
    Wrangler rejects a migration with no statements (research R8).
- [x] T039 [US3] Validate the migration with quickstart §2.
  - `npx wrangler d1 migrations apply onestopshop --local` applies `0001_baseline.sql`.
    Running it a second time reports nothing to apply, without error.
  - Run `npx wrangler d1 execute onestopshop --local --command "SELECT name FROM
sqlite_master WHERE type='table'"`. Only `d1_migrations` and `_cf_*` internal tables are
    listed.
  - If D1 rejects `SELECT 1;`, replace it with another statement that creates no table, and
    record the change in research R8.

**Checkpoint**: All of User Story 3 is complete. No application code reads `DB`.

---

## Phase 6: User Story 4 - Set up and deploy from the README alone (Priority: P3)

**Goal**: A developer goes from a clean machine to local and deployed apps using only the README,
with nothing secret committed.

**Independent Test**: Follow the README on a clean checkout (quickstart §5–§6), and confirm
`git grep` finds no credential.

- [x] T040 [P] [US4] Rewrite `README.md` per FR-017. Use exact commands, cover both Windows
      PowerShell and POSIX where they differ, and keep each section short.
  - **Prerequisites**: Node ≥ 22.12, PowerShell 7, `npm install`, and `npm run e2e:install`.
  - **Google Cloud**:
    - project `worksheetproject`, and the OAuth consent screen
    - identity-only scopes (`openid`, `email`, `profile`), and the owner added as a test user
    - a web client with redirect URIs for `http://localhost:3000/api/auth/google/callback` and
      the deployed `https://<worker>.workers.dev/api/auth/google/callback`
    - the downloaded `client_secret_*.json` stays gitignored
  - **Local configuration**: a table of the four variables from
    [contracts/configuration.md](contracts/configuration.md), how to generate `SESSION_SECRET`,
    and that `.env.local` and `.dev.vars` hold the same values.
  - **Local database**:
    - `npx wrangler d1 migrations apply onestopshop --local`
    - the database file lives under the gitignored `.wrangler/state/`
    - reset by deleting `.wrangler/state/v3/d1` and re-applying
  - **Run and test**: `npm run dev`, `scripts/check.ps1`, `scripts/e2e.ps1`, and
    `npm run preview`.
  - **Cloudflare**:
    - `npx wrangler login`, then `npx wrangler d1 create`, then the `d1_databases` block
    - `npx wrangler secret put GOOGLE_CLIENT_SECRET` and `npx wrangler secret put SESSION_SECRET`
    - non-secret `vars` in `wrangler.jsonc`
    - `npx wrangler d1 migrations apply onestopshop --remote`
    - `npm run deploy`, then register the deployed redirect URI
  - **Verifying**: sign-in and the database work in each environment (quickstart §2, §4, §6).
- [x] T041 [P] [US4] Create `docs/architecture/004-hosting-and-persistence.md` in the ADR format
      of `001`–`003` (Status: accepted, Date: 2026-10-01). Record:
  - Cloudflare Workers via OpenNext (R1)
  - no Proxy, with per-page `requireSession` (R2)
  - Arctic, plus a stateless 90-day `jose` session with no Google tokens kept (R3, R4)
  - `Secure` derived from the request protocol (R5)
  - D1 with Wrangler migrations, and Drizzle deferred until the first table (R8)
  - configuration split between `.env.local`/`.dev.vars`, `vars` and secrets (R9)
  - the free-plan 3 MiB Worker limit
- [ ] T042 [US4] Developer action (interactive), quickstart §5–§6:
  - Run `npm run preview` and confirm the build reports a compressed Worker size under 3 MiB;
    record the size in ADR 004.
  - Set secrets with `npx wrangler secret put GOOGLE_CLIENT_SECRET` and
    `npx wrangler secret put SESSION_SECRET`. Use a new value for `SESSION_SECRET`, not the
    local one.
  - Run `npx wrangler d1 migrations apply onestopshop --remote`, then `npm run deploy`.
  - Add the deployed callback URI in Google Cloud.
  - Sign in on the deployed URL, and confirm the `session` cookie shows `Secure`.
- [x] T043 [US4] Run a credential scan:
  - Run `git grep -nE "GOCSPX|client_secret\"|SESSION_SECRET=|ya29\."`. It must match nothing
    except variable names in docs.
  - Confirm `git status --ignored` lists `.env.local`, `.dev.vars` and `client_secret_*.json` as
    ignored.

**Checkpoint**: All user stories are complete, and the app is deployed.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Bring the docs that still describe Google Sheets in line with constitution 2.0.0,
and do the final validation.

- [x] T044 [P] Update `CLAUDE.md`.
  - **Project section**: persistence becomes D1/SQLite via the Worker binding (not a Google
    Sheet), hosting becomes Cloudflare Workers via OpenNext, and Google OAuth is used for
    identity only.
  - **Project state section**: list what now exists — sign-in, the session cookie,
    `src/lib/server/`, `/api/auth/*`, `wrangler.jsonc`, and `migrations/`. List what is still
    not built — fitness data, `src/components/`, `src/features/`, CI, and Drizzle.
  - Leave the `# This is NOT the Next.js you know` block untouched.
- [x] T045 [P] Update `docs/03-typescript.md` and `docs/04-react-and-nextjs.md`.
  - Replace the Google Sheets examples and wording with the database (D1), keeping each rule
    intact.
  - In `04`, update the `lib/server/` folder description to "config, session, google sign-in",
    and note that auth is checked per page with `requireSession`, never in Proxy (ADR 004).
- [x] T046 [P] Update the ADRs in `docs/architecture/`:
  - `001-application-foundation.md`: change the "Hosting still undecided" section to state it
    was decided in 004.
  - `002-testing-strategy.md` and `003-development-workflow.md`: reword the Google Sheets
    mentions to the database, without changing any decision.
- [ ] T047 Developer action: run quickstart §7 on the iPhone.
  - Add to the Home Screen from the deployed URL.
  - Sign in from the standalone app; Google's sheet must return into the app signed in
    (research R12).
  - Navigate to the fitness tracker and back.
  - Force-quit, relaunch and lock/unlock: the landing page appears in under 2 s with no sign-in.
- [x] T048 Run quickstart §8 on a scratch branch: add a trivial second route and registry entry,
      then confirm `git diff --stat` shows no file under `src/app/fitness-tracker/`. Discard the
      branch.
- [ ] T049 Final gate.
  - `pwsh -NoProfile -File scripts/check.ps1` exits 0.
  - `pwsh -NoProfile -File scripts/e2e.ps1` passes, and `e2e/app-foundation.spec.ts` is
    unmodified since T008.
  - Remove `fitness-tracker-spec_1.md` from the repo root, or confirm with the developer that it
    is kept, since its content now lives in `specs/001-app-foundation/`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T007 depends on T001–T006.
- **Foundational (Phase 2)**: depends on Setup and blocks all stories.
  - T008 goes first.
  - T009–T011 run in parallel.
  - Then T012–T014.
  - Then T015, which needs T012 and T014.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on Foundational. T035 and T036 call `requireSession`, which comes
  from Foundational, and T035 extends US1's `LandingScreen` (T028). So run US2 after US1.
- **US3 (Phase 5)**: depends only on Setup (T002). It is independent of US1 and US2 and can run
  any time after Phase 1.
- **US4 (Phase 6)**: T040 and T041 can start after Foundational. T042 needs US1–US3 done.
- **Polish (Phase 7)**: after all stories.

### Within Each User Story

- Each test task is written and seen failing before its implementation task.
- Strings come before the components that use them.
- `google-sign-in.ts` (T022) comes before the route files (T023, T024).
- Presentational screens come before the async pages that render them.

### Parallel Opportunities

- **Setup**: T002–T006.
- **Foundational**: T009, T010, T011, then T013 and T014.
- **US1**: tests T016–T019 together, then T020 and T021.
- **US2**: T030–T033.
- **US3**: alongside US1 and US2, once Setup is done.
- **US4 and Polish**: T040, T041, T044, T045 and T046 are documentation in separate files.

---

## Parallel Example: User Story 1

```text
Task: "Write src/lib/server/google-sign-in.test.ts"        (T016)
Task: "Write src/app/api/auth/sign-out/route.test.ts"      (T017)
Task: "Write src/app/sign-in/SignInScreen.test.tsx"        (T018)
Task: "Write src/lib/sign-in-error.test.ts"                (T019)

Then:
Task: "Create src/lib/strings/auth.ts"                     (T020)
Task: "Implement src/lib/sign-in-error.ts"                 (T021)
```

## Parallel Example: User Story 2

```text
Task: "Write src/lib/features.test.ts"                               (T030)
Task: "Extend src/app/LandingScreen.test.tsx"                        (T031)
Task: "Write src/app/fitness-tracker/FitnessTrackerScreen.test.tsx"  (T032)
Task: "Create src/lib/strings/features.ts"                           (T033)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup, then Phase 2 Foundational. The acceptance spec is red.
2. Phase 3 (US1). Sign-in, protection and sign-out all work locally.
3. **Stop and validate**: the US1 acceptance group passes, and quickstart §4 passes with a real
   Google account.

### Incremental Delivery

1. Setup + Foundational gives a red acceptance spec and the session building blocks.
2. US1: a signed-in, protected app (MVP).
3. US2: the feature registry and the fitness tracker route.
4. US3: the D1 binding and the empty baseline (can be done any time after Setup).
5. US4: README, ADR 004 and a live deployment.
6. Polish: stale docs, the iPhone check, and the final gate. The acceptance spec is green and
   untouched.

---

## Notes

- Tasks marked "Developer action" need the developer's interactive logins (Cloudflare, Google)
  or their iPhone. An implementing agent stops and asks at those points.
- Never print or commit the contents of `client_secret_*.json`, `.env.local` or `.dev.vars`.
- Commit after each phase checkpoint, with `scripts/check.ps1` exiting 0.
