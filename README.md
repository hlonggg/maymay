# Maymay Telegram Mini App

TypeScript starter for the Maymay Telegram Mini App, built with Next.js App Router and Prisma.

## Requirements

- Node.js 20.9 or later
- npm
- PostgreSQL

## Local development

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL`.

3. Generate the Prisma client and apply the initial database migration:

   ```powershell
   npm run db:generate
   npm run db:migrate
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

Open `http://localhost:3000`. The health endpoint is available at `/api/health`.

## Project structure

- `app/`: Next.js pages, shared styling, and API routes
- `prisma/schema.prisma`: initial PostgreSQL data model
- `.env.example`: environment variable names; do not put real secrets in this file

## UI preview

The home page currently includes responsive screens for the dashboard, tasks and reward verification, wallet/withdrawal, leaderboard, daily check-in, account profile, and the admin feature menu. The admin menu opens separate demo sections for task management, auto-review/captcha settings, blocklist, withdrawal review, and system settings.

Navigation and sample interactions work locally. Cloudflare Turnstile is verified by a server endpoint; rewards, slider, withdrawals, admin controls, and account details are preview-only and do not persist or call a production backend.

### Cloudflare Turnstile on Railway

1. Create a Turnstile widget in the Cloudflare dashboard for the app's Railway domain (and custom domain, if applicable). Use the production site key and secret key, not Cloudflare's test keys.
2. In Railway, add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` with the widget site key and `TURNSTILE_SECRET_KEY` with the widget secret. The secret is server-only; never use a `NEXT_PUBLIC_` prefix for it.
3. Optionally set `TURNSTILE_ALLOWED_HOSTNAMES` to a comma-separated allowlist, for example `your-app.up.railway.app,app.example.com`.
4. Redeploy so Next.js includes the public site key in the browser bundle and the server receives the secret.

The task verification screen renders the real Turnstile widget. Its one-time token is posted to `/api/captcha/verify`, where the server calls Cloudflare Siteverify and checks the expected `task_claim` action and, when configured, the response hostname. The task reward is still demo-only: passing captcha does not award a real balance because task completion and the reward ledger have not yet been implemented server-side.

## Security status

This is a starter scaffold, not a production-ready rewards system. Telegram `initData` verification, authorization, rate limits, shortener adapters, task completion, balance/ledger transactions, and withdrawal review still need server-side implementations and tests.

Keep bot, provider, and hashing secrets in server-only environment variables. Do not commit secret values or expose them through `NEXT_PUBLIC_*`.

## GitHub

This project belongs in the clone at `https://github.com/hlonggg/maymay`. Run Git commands from the repository root after opening this folder in VS Code.
