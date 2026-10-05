# Stride on Cloudflare

This repository preserves Stride's training, interval timers, partial logs,
backdated edits, plans, exports and offline drafts. The Cloudflare version uses
one fixed account (`felixdasumo`) and has no registration route. It does not
accept Sites/ChatGPT identity headers. The original Sites deployment is separate.

## Verified build connection

A push to `main` on 5 October 2026 triggered **Workers Builds: stride** and
completed successfully (Cloudflare version `37d67094-c3fc-44ca-9014-84ce9a8b3e0a`).
This verifies the GitHub build connection. It does not verify the runtime
password secret, D1 schema, original workout transfer, or live login.

## First deployment

1. Use Node 24 and the pinned pnpm version. Install with `pnpm install --frozen-lockfile`.
2. Create a Cloudflare D1 database and set `STRIDE_D1_DATABASE_ID` in the build
   environment, or put its real ID in `wrangler.json`. Set `STRIDE_WORKER_NAME`
   if the existing Worker has a different name. No resource ID is assumed.
3. Run `npm run build:cloudflare`. This checks tests and types before building.
4. Provide the chosen password on stdin to `node scripts/hash-password.mjs`.
   The script writes only a salted password hash to the ignored private folder.
   Upload it to the Worker using `wrangler secret bulk .private/auth-secrets.json`.
   Never commit the password, hash file, `.dev.vars`, or workout backup.
5. Run `npm run deploy`. It applies the idempotent D1 schema migrations, then
   deploys the built Worker. The build output must already exist.
6. Verify the deployed login, sign-out, rejected credentials, saved workouts,
   and a second-device reload. Missing secrets fail closed with a 503 response.

## Deploy automatically from GitHub

In the Worker's Builds settings, connect `ffelixq/ippt`, select `main` as the
production branch, and use:

| Setting | Value |
| --- | --- |
| Root directory | `/` |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npm run deploy` |
| Node version | `24` |
| Build variable | `STRIDE_D1_DATABASE_ID` with the real D1 ID |

The build's Cloudflare token needs permission to deploy the Worker and apply D1
migrations. Keep the runtime password hash as a Worker secret, separate from
build variables. Confirm one successful main-branch build before describing
automatic deployment as active. Do not attach preview branches to production D1.

## Migrate the original account

Export **Full backup** from the signed-in original Stride site. Use the original
JSON, not CSV or reconstructed workouts:

```sh
node scripts/prepare-account-import.mjs /path/to/stride-backup.json
wrangler d1 execute DB --remote --file .private/original-state.sql
```

The private SQL inserts the full original state under the fixed account and
preserves all optional fields. It never overwrites an existing account. Check
the returned `imported` value and workout count. If the account was already used,
export its backup first and use Stride's reviewed **Restore backup** flow.
Compare both original workout IDs and all actual sets, dates, times, distances,
recoveries and notes after migration. Do not remove the original records.

## Local checks

```sh
npm test
npm run typecheck
npm run db:local
npm run dev
```

For local sign-in, put a development-only `STRIDE_PASSWORD_HASH` in ignored
`.dev.vars`. Production cookies are HttpOnly, Secure and SameSite=Strict.
Sessions expire after 30 days; signing out revokes the session and removes the
device copy. Password-hash changes invalidate existing sessions. Login attempts
are limited across the entire single account, including changing IP addresses
and usernames. Offline use is available only to a previously signed-in device
until its remembered session expires; the server always validates its own
session cookie on reconnect.

Cloudflare account access, the real D1 binding, the runtime secret, a successful
deployment, and the original full backup are prerequisites still to verify
outside the source code. A plugin being created does not verify its connection.
