# Configuration Contract: App Foundation

**Feature**: [../spec.md](../spec.md) · **Research**: [../research.md](../research.md) (R1, R8, R9)

## Application variables

All four are read only by the server-only config module. A missing value fails the request with a
server error whose log names the variable; the value itself is never logged or sent to the
browser.

| Name                   | Purpose                         | Local (`.env.local`, mirrored in `.dev.vars`)                       | Deployed                                   |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | OAuth client identifier         | `client_id` from the downloaded client JSON                         | `wrangler.jsonc` → `vars`                  |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret             | `client_secret` from the downloaded client JSON                     | `wrangler secret put GOOGLE_CLIENT_SECRET` |
| `SESSION_SECRET`       | HS256 signing key for `session` | 32+ random bytes, base64; local value differs from the deployed one | `wrangler secret put SESSION_SECRET`       |
| `OWNER_EMAIL`          | The only account allowed in     | The owner's Google email                                            | `wrangler.jsonc` → `vars`                  |

## Cloudflare (`wrangler.jsonc`, committed — contains no secrets)

| Key                   | Value                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `name`                | `onestopshop`                                                                                                           |
| `account_id`          | `2c9deedd46d8135271fef57c6854e55c`                                                                                      |
| `main`                | `.open-next/worker.js`                                                                                                  |
| `compatibility_flags` | `nodejs_compat`, `global_fetch_strictly_public`                                                                         |
| `assets`              | `{ directory: ".open-next/assets", binding: "ASSETS" }`                                                                 |
| `services`            | `WORKER_SELF_REFERENCE` → `onestopshop`                                                                                 |
| `d1_databases`        | `{ binding: "DB", database_name: "onestopshop", database_id: <from wrangler d1 create>, migrations_dir: "migrations" }` |

## Google Cloud (project `worksheetproject`)

| Setting                  | Value                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scopes                   | `openid`, `email`, `profile` only                                                                                                                              |
| Test users               | The owner's Google account                                                                                                                                     |
| Authorised redirect URIs | `http://localhost:3000/api/auth/google/callback` (registered); `https://onestopshop.<subdomain>.workers.dev/api/auth/google/callback` (add after first deploy) |

## Never committed

`.env.local`, `.dev.vars`, `client_secret_*.json`, `.wrangler/` and `.open-next/`. Everything
except `.dev.vars` is already gitignored; this feature adds `.dev.vars`.
