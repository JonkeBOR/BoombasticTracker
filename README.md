# OneStopShop

A personal web app, installed to an iPhone Home Screen as a PWA. Fitness tracking is its first
feature. It runs as a single Cloudflare Worker: Next.js 16 built with OpenNext, Google sign-in for
identity, and a Cloudflare D1 database.

This README takes you from a clean machine to a running local app and a deployed one. Commands are
for PowerShell 7; they are identical in a POSIX shell unless noted.

## 1. Prerequisites

- Node.js 22.12 or newer, and PowerShell 7 (`pwsh`)
- A Google account (the owner) and a free Cloudflare account

```powershell
npm install
npm run e2e:install
```

`npm install` asks npm to run the install scripts approved in `package.json` (`allowScripts`) for
`workerd` and `esbuild`, which Wrangler needs. If a newer version shows as blocked, review it with
`npm install-scripts ls` and approve it with `npm install-scripts approve <package>`.

## 2. Google sign-in

The app uses Google only to learn who is signing in. It requests the `openid`, `email` and
`profile` scopes and never stores a Google token.

In the [Google Cloud Console](https://console.cloud.google.com/), in the project used by this app
(`worksheetproject`):

1. **OAuth consent screen**: choose External, keep the app in Testing, and add only the scopes
   `openid`, `email` and `profile`. Do not add Google Sheets or any other API scope.
2. **Test users**: add the owner's Google account. While in Testing, only listed accounts can
   reach the app's sign-in at all.
3. **Credentials → Create credentials → OAuth client ID**: application type _Web application_,
   with these authorised redirect URIs:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://onestopshop.<your-subdomain>.workers.dev/api/auth/google/callback` (add this
     after the first deploy, once the address is known)
4. Download the client JSON. Files named `client_secret_*.json` are gitignored. Copy the values
   out of it (next section) and keep the file outside version control.

## 3. Local configuration

Create `.env.local` (read by `next dev`) and `.dev.vars` (read by `npm run preview`) in the
repository root with **identical** content. Both files are gitignored.

```dotenv
GOOGLE_CLIENT_ID=<client_id from the downloaded JSON>
GOOGLE_CLIENT_SECRET=<client_secret from the downloaded JSON>
SESSION_SECRET=<random value, see below>
OWNER_EMAIL=<the owner's Google email>
```

| Variable               | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Identifies the OAuth client to Google                            |
| `GOOGLE_CLIENT_SECRET` | Authenticates the server to Google's token endpoint              |
| `SESSION_SECRET`       | Signs the 90-day session cookie; changing it signs everyone out  |
| `OWNER_EMAIL`          | The only Google account allowed in; any other account is refused |

Generate `SESSION_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 4. Local database

The app has a Cloudflare D1 database bound as `DB`. Locally, Wrangler keeps it as a SQLite file
under `.wrangler/state/` (gitignored), and `next dev` uses the same file.

```powershell
npx wrangler d1 migrations apply onestopshop --local
```

The only migration so far, `migrations/0001_baseline.sql`, creates no tables. To reset the local
database, delete `.wrangler/state/v3/d1` and apply the migrations again.

## 5. Run and test locally

```powershell
npm run dev                                   # http://localhost:3000
pwsh -NoProfile -File scripts/check.ps1       # format, lint, typecheck, unit tests
pwsh -NoProfile -File scripts/e2e.ps1         # Playwright acceptance tests (mobile WebKit)
npm run preview                               # build and run on the real Workers runtime
```

Open `http://localhost:3000`, choose **Sign in with Google**, and sign in as the owner. You should
land on the list of tools, and stay signed in across reloads.

## 6. Cloudflare

Log in once and create the database:

```powershell
npx wrangler login
npx wrangler d1 create onestopshop
```

`wrangler.jsonc` already holds the id of the project's database. If you create your own, put the
printed `database_id` into the existing `DB` entry under `d1_databases`. If Wrangler offers to add
the database to the configuration itself, it appends a **second** entry; merge it into the `DB`
entry and keep `migrations_dir`, because the app and the migration commands use the first entry.

Everything in `wrangler.jsonc` is non-secret and committed, including the `vars` block holding
`GOOGLE_CLIENT_ID` and `OWNER_EMAIL`.

Set the two secrets. Use a **new** `SESSION_SECRET` for production, not the local one:

```powershell
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
```

Deploys run only from GitHub Actions: every push to `main` runs the quality gate, applies D1
migrations and deploys (`.github/workflows/deploy.yml`). It needs `CLOUDFLARE_API_TOKEN` as a
secret of the `production` environment, scoped to Workers Scripts: Edit and D1: Edit on this
account:

```powershell
gh secret set CLOUDFLARE_API_TOKEN --env production
```

Never deploy from a working copy. OpenNext copies every `.env*` file it finds into the Worker
bundle, so a build on a machine with `.env.local` uploads the local secrets. If the workflow is
unavailable, deploy from a fresh clone that has no `.env*` files.

The Worker's address is `https://onestopshop.<sub>.workers.dev`. Add its callback URI to the
Google OAuth client (section 2, step 3). The free Workers plan limits the Worker to 3 MiB
compressed, and the build output reports the size.

## 7. Verifying each environment

| Check                         | Local                                 | Deployed                                |
| ----------------------------- | ------------------------------------- | --------------------------------------- |
| Sign-in reaches the tool list | `http://localhost:3000`               | `https://onestopshop.<sub>.workers.dev` |
| Session cookie                | `session`, `HttpOnly`                 | `session`, `HttpOnly`, `Secure`         |
| Another Google account        | "not allowed" message, no session     | same                                    |
| Database migrated             | `migrations list onestopshop --local` | `migrations list onestopshop --remote`  |

Both `migrations list` commands run as `npx wrangler d1 migrations list …` and should show
`0001_baseline.sql` as applied.

## Never commit

`.env.local`, `.dev.vars`, `client_secret_*.json`, `.wrangler/` and `.open-next/` are gitignored.
Secrets live only in those local files and in Wrangler secrets.
