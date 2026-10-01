# Data Model: App Foundation with Fitness Tracker Entry

**Feature**: [spec.md](spec.md) · **Research**: [research.md](research.md)

This feature stores **no application data in the database**. Its state lives in signed cookies, in
configuration, and in one in-code registry. The database exists only with the baseline migration
applied.

## Owner (configuration)

| Field   | Source        | Rule                                                               |
| ------- | ------------- | ------------------------------------------------------------------ |
| `email` | `OWNER_EMAIL` | Required. Compared case-insensitively with the ID token's `email`. |

Access is granted only when the ID token has `email_verified === true` and its `email` matches
(research R6).

## Session (cookie `session`)

A JWT signed with HS256 using `SESSION_SECRET` (research R4).

| Claim   | Type             | Rule                                        |
| ------- | ---------------- | ------------------------------------------- |
| `sub`   | string           | The Google subject of the owner; non-empty. |
| `email` | string           | The owner's email at sign-in.               |
| `iat`   | number (seconds) | Issue time.                                 |
| `exp`   | number (seconds) | `iat + 90 days`.                            |

**Validity**: the signature verifies with the current `SESSION_SECRET`, and `exp` is in the future.
The token also gets an algorithm check, accepting only HS256. Anything else counts as no session.
Rotating `SESSION_SECRET` therefore signs everyone out, which is the intended way to revoke a
session.

**Lifecycle**:

```text
(none) ──Google callback, owner verified──▶ active ──exp passes──▶ expired (= none)
   ▲                                          │
   └────────────── sign-out ──────────────────┘
```

**Cookie attributes**: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=7776000`, plus `Secure`
when the request is HTTPS (research R5). The session never contains a Google token, because none
is kept anywhere.

## Sign-in attempt (short-lived cookies)

These exist only between "Sign in with Google" and the callback.

| Cookie                | Content                                 | Lifetime   |
| --------------------- | --------------------------------------- | ---------- |
| `oauth_state`         | Random `state` from Arctic              | 10 minutes |
| `oauth_code_verifier` | PKCE code verifier                      | 10 minutes |
| `oauth_return_to`     | Validated same-origin path, default `/` | 10 minutes |

All three use the same attributes as the session cookie, except `Max-Age=600`. The callback
deletes all three whatever the outcome.

## Sign-in error

These are the values carried as `/sign-in?error=…`. Each maps to one string constant on the
sign-in screen.

| Code          | Cause                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `cancelled`   | Google returned `error=access_denied`; the owner cancelled or refused consent                  |
| `not-allowed` | The account is not the owner, or its email is not verified                                     |
| `expired`     | State cookie missing or mismatched, or no verifier; the attempt timed out or was tampered with |
| `unavailable` | Token exchange or network failure talking to Google                                            |

An unknown or absent code shows no message.

## Feature (in-code registry, `src/lib/features.ts`)

| Field         | Type   | Rule                                                  |
| ------------- | ------ | ----------------------------------------------------- |
| `id`          | string | Unique; used as the React key.                        |
| `path`        | string | The feature's route segment, e.g. `/fitness-tracker`. |
| `title`       | string | Taken from a strings module.                          |
| `description` | string | Taken from a strings module.                          |

Initial content is exactly one entry, the fitness tracker. The registry is ordered as displayed.

## Database (D1 binding `DB`)

| Migration                      | Effect                                 |
| ------------------------------ | -------------------------------------- |
| `migrations/0001_baseline.sql` | One no-op statement; creates no tables |

After it is applied, the only table is Wrangler's own `d1_migrations` tracking table, which
contains the baseline row. No code in this feature reads the binding.
