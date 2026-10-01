# HTTP Contract: App Foundation

**Feature**: [../spec.md](../spec.md) · **Data model**: [../data-model.md](../data-model.md)

Every response here is HTML or a redirect; this feature has no JSON endpoint. "Session" means a
valid `session` cookie as defined in the data model.

## Pages

| Path               | Without session                                                                                                                              | With session                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | `307` → `/sign-in?returnTo=%2F`                                                                                                              | Landing page: one card per registry entry (today only "Fitness Tracker", linking to `/fitness-tracker`) and a "Sign out" button |
| `/fitness-tracker` | `307` → `/sign-in?returnTo=%2Ffitness-tracker`                                                                                               | Placeholder page naming the fitness tracker, with a link back to `/`                                                            |
| `/sign-in`         | Sign-in screen: a "Sign in with Google" link to `/api/auth/google?returnTo=<returnTo>`, plus the message for `?error=` if it is a known code | `307` → `returnTo` if valid, else `/`                                                                                           |
| any other path     | Next's not-found page, `404`                                                                                                                 | Next's not-found page, `404`                                                                                                    |

The sign-in screen passes `returnTo` through only if it is a valid same-origin path (research R7);
otherwise it is dropped.

## Route handlers

### `GET /api/auth/google`

Starts a sign-in attempt.

- Query: `returnTo` (optional; invalid values become `/`).
- Response: `302` to Google's authorization endpoint with `response_type=code`,
  `scope=openid email profile`, `state`, `code_challenge` and `code_challenge_method=S256`, and
  `redirect_uri=<request origin>/api/auth/google/callback`.
- Sets the `oauth_state`, `oauth_code_verifier` and `oauth_return_to` cookies.

### `GET /api/auth/google/callback`

Completes a sign-in attempt. It always clears the three `oauth_*` cookies.

| Condition, checked in order                                                     | Response                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Query has `error=access_denied`                                                 | `302` → `/sign-in?error=cancelled`                      |
| Query has any other `error`                                                     | `302` → `/sign-in?error=unavailable`                    |
| `state` missing, `oauth_state` cookie missing, they differ, or verifier missing | `302` → `/sign-in?error=expired`                        |
| Code exchange with Google fails                                                 | `302` → `/sign-in?error=unavailable`                    |
| ID token email not verified or not `OWNER_EMAIL`                                | `302` → `/sign-in?error=not-allowed`, no session cookie |
| Otherwise                                                                       | Sets `session`; `302` → `oauth_return_to` (or `/`)      |

No response body or redirect URL ever contains a Google token, the authorization code, or a
provider error message.

### `POST /api/auth/sign-out`

- Clears `session`.
- Response: `303` → `/sign-in`.
- Works with or without a session (idempotent). It is submitted by a plain `<form method="post">`,
  so it works without client JavaScript. Because the cookie is `SameSite=Lax`, a cross-site POST
  carries no session, so forging this request has no effect beyond what it does anyway.

`GET /api/auth/sign-out` → `405`.
