# Maymay Telegram Mini App

Next.js App Router, TypeScript, Prisma, and PostgreSQL.

## Railway deployment

1. Deploy the `main` branch from GitHub in Railway and add a PostgreSQL service to the same project.
2. In the app service variables, set `DATABASE_URL` using Railway's reference picker for the PostgreSQL service's `DATABASE_URL`.
3. Set the following variables:
   - `TELEGRAM_BOT_TOKEN`: from BotFather. Keep it server-side and do not share or commit it.
   - `AUTH_SESSION_SECRET`: random value with at least 32 characters.
   - `ADMIN_TELEGRAM_IDS`: comma-separated Telegram numeric IDs allowed to administer the app.
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile keys.
   - `TURNSTILE_ALLOWED_HOSTNAMES`: optional comma-separated Railway/custom hostnames.
4. `railway.json` configures Prisma migrations as the pre-deploy command, runs the Next.js build/start commands, and uses `/api/health` as the health check.
5. Railway provides `RAILWAY_PUBLIC_DOMAIN` automatically when the service has a public domain; do not add it manually.
6. Once the app is deployed, run `npm run telegram:webhook:set` in the Railway service Console. This registers the Telegram webhook and makes `/start` reply with an inline **Mở Mini App** button pointing to the Railway HTTPS URL. The webhook secret is derived from `TELEGRAM_BOT_TOKEN`; no extra secret variable is needed. The button is available in a private chat with the bot. Open the app from Telegram; direct browser access intentionally does not authenticate.
6. Check `/api/health`; it reports PostgreSQL connectivity.

## Local development

Install Node.js 20.9 or later and npm. Run `npm install`, copy `.env.example` to `.env`, set PostgreSQL and Telegram variables, then run:

```powershell
npm run db:generate
npm run db:migrate
npm run dev
```

Open the app from a Telegram test Mini App URL so it provides a signed `initData` payload.

## Current implementation status

- Telegram `initData` is checked server-side using the bot token.
- The Telegram webhook validates Telegram's secret-token header and replies to private `/start` messages with an inline Mini App button.
- Users are created or updated in PostgreSQL and authenticated with a signed, HttpOnly session cookie.
- The authenticated `/api/me` endpoint returns the current user's real balance, ledger entries, and active database tasks.
- `/api/health` performs a PostgreSQL query; it returns HTTP 503 if the database is unavailable.
- Admin navigation is shown only to Telegram IDs listed in `ADMIN_TELEGRAM_IDS`. Authorized admins can create and list tasks in PostgreSQL; new tasks remain `PAUSED`.
- Cloudflare Turnstile verification is implemented at `/api/captcha/verify`, but it is not wired to a reward flow.

This is not yet a complete rewards application. Link-provider adapters, attempt creation, completion callbacks, transaction-safe reward crediting, withdrawal requests/reviews, leaderboard/check-in APIs, and admin write APIs still need implementation. The UI intentionally does not simulate those operations or grant rewards.

## Environment variables

See `.env.example` for the complete list. Never commit real secrets or expose server-side secrets through `NEXT_PUBLIC_*`.
