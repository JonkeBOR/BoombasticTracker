# Quickstart: Validating the App Foundation

**Feature**: [spec.md](spec.md) · **Contracts**: [contracts/http.md](contracts/http.md),
[contracts/configuration.md](contracts/configuration.md)

This guide proves the feature works end to end. Step-by-step setup prose belongs in the
repository README (FR-017); this file lists what to run and what must be observed.

## Prerequisites

- Node.js ≥ 22.12, PowerShell 7, `npm install` and `npm run e2e:install` done.
- `.env.local` and `.dev.vars` filled in per [configuration](contracts/configuration.md).
- `npx wrangler login` completed against account `2c9deedd46d8135271fef57c6854e55c`.
- The D1 database created with `npx wrangler d1 create onestopshop`, and its id copied into
  `wrangler.jsonc`.

## 1. Quality gate

```powershell
pwsh -NoProfile -File scripts/check.ps1
```

**Expect** exit code `0`. The Vitest suite covers:

- session signing and verification (valid, expired, tampered, wrong secret, wrong algorithm)
- `returnTo` validation
- the owner check
- error-code mapping
- each route handler's responses from the [HTTP contract](contracts/http.md)

## 2. Baseline migration (US3, FR-014, FR-016, SC-008)

```powershell
npx wrangler d1 migrations apply onestopshop --local
npx wrangler d1 migrations apply onestopshop --local
npx wrangler d1 execute onestopshop --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

**Expect**:

- The first apply reports `0001_baseline.sql` as applied.
- The second reports nothing to apply and no error.
- The table list contains only Wrangler's `d1_migrations` (plus any `_cf_` internal table), and no
  application table.

## 3. Acceptance tests (US1, US2, US3)

```powershell
pwsh -NoProfile -File scripts/e2e.ps1
```

**Expect** all to pass:

- Signed out, `/` and `/fitness-tracker` show the sign-in screen with "Sign in with Google".
- Each `?error=` code shows its message.
- Signed in (minted cookie, research R10): the landing page lists exactly "Fitness Tracker".
- Tapping the card opens `/fitness-tracker`'s placeholder, and the back link returns to `/`.
- Opening `/fitness-tracker` directly works.
- "Sign out" returns to the sign-in screen, after which `/` is protected again.

## 4. Real Google sign-in, locally (US1, FR-002, FR-008, FR-009, SC-004, SC-005)

```powershell
npm run dev
```

At `http://localhost:3000`:

1. Sign in with the owner's account and land on the landing page. Reload, close and reopen the
   tab: you are still signed in.
2. In dev tools: the only app cookie besides transient `oauth_*` ones is `session`, flagged
   `HttpOnly`. `localStorage`, `sessionStorage` and IndexedDB hold nothing from Google. No
   response body or page source contains `ya29.`, `1//` or an `id_token`.
3. Sign out, then sign in with a different Google account (added as a test user to make the
   attempt possible): the "not allowed" message appears and no `session` cookie is set.
4. Start sign-in and press Cancel on Google's page: the "cancelled" message appears.

## 5. Preview on the Workers runtime

```powershell
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview
```

**Expect**:

- The build succeeds and reports a compressed Worker size under **3 MiB** (free-plan limit,
  research R1).
- Step 4.1 works against the preview URL, if that origin is registered in Google; otherwise check
  that `/` redirects to `/sign-in`.

## 6. Deploy (US4, FR-019, SC-007, SC-008)

```powershell
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler d1 migrations apply onestopshop --remote
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

Then register `https://<worker>.workers.dev/api/auth/google/callback` in Google Cloud.

**Expect**:

- The remote apply reports `0001_baseline.sql`.
- The deployed URL serves over HTTPS.
- Step 4 passes against it, and the `session` cookie additionally shows `Secure`.

## 7. iPhone Home Screen (US1, US2, FR-013, SC-001–SC-003)

1. Open the deployed URL in Safari and add it to the Home Screen.
2. Launch from the icon. The sign-in screen appears in standalone mode. Sign in, and Google's
   sheet returns into the app, signed in (research R12).
3. Tap "Fitness Tracker" and go back. No browser chrome appears at any point.
4. Force-quit, relaunch and lock/unlock: the landing page appears in under 2 seconds with no
   sign-in prompt.

## 8. Adding a feature touches nothing else (FR-012, SC-006)

On a scratch branch, add a trivial second route folder and one registry entry, then run
`git diff --stat`.

**Expect** no file under `src/app/fitness-tracker/` in the diff. Discard the branch afterwards.
