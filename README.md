# Maymay Telegram Mini App

Next.js App Router, TypeScript, Prisma, and PostgreSQL.

## Railway deployment

1. Deploy the `main` branch from GitHub in Railway and add a PostgreSQL service to the same project.
2. In the app service variables, set `DATABASE_URL` using Railway's reference picker for the PostgreSQL service's `DATABASE_URL`.
3. Set the following variables:
   - `TELEGRAM_BOT_TOKEN`: from BotFather. Keep it server-side and do not share or commit it.
   - `MINI_APP_URL`: the full public HTTPS URL, e.g. `https://your-service.up.railway.app`.
   - `AUTH_SESSION_SECRET`: random value with at least 32 characters.
   - `ADMIN_TELEGRAM_IDS`: comma-separated Telegram numeric IDs allowed to administer the app.
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile keys.
   - `TURNSTILE_ALLOWED_HOSTNAMES`: optional comma-separated Railway/custom hostnames.
4. `railway.json` configures Prisma migrations as the pre-deploy command, runs the Next.js build/start commands, and uses `/api/health` as the health check.
5. Set `MINI_APP_URL` to the public HTTPS URL of the deployed app. This is used both to register the webhook URL and as the Mini App button target.
6. Once the app is deployed and the variable is set, run `npm run telegram:webhook:set` in the Railway service Console. This registers the Telegram webhook and makes `/start` reply with an inline **Mở Mini App** button. The webhook secret is derived from `TELEGRAM_BOT_TOKEN`; no extra secret variable is needed. The button is available in a private chat with the bot. Open the app from Telegram; direct browser access intentionally does not authenticate.
7. Check `/api/health`; it reports PostgreSQL connectivity.

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
- Admin navigation is shown only to Telegram IDs listed in `ADMIN_TELEGRAM_IDS`. The admin panel reads dashboard statistics, users, withdrawals, and audit activity from PostgreSQL; authorized admins can block/unblock accounts, create/list tasks, and review withdrawals. New tasks remain `PAUSED`; withdrawal approval records that an external payout was made, while rejection refunds only when a matching reserve ledger entry exists.
- Starting an active Link4m task creates a random 30-minute attempt token, stores its hash and starting IP, asks the Link4m shortening API to shorten that unique callback URL, then shows the returned URL and a **Làm ngay** button. After the shortener completes, it must redirect the user's browser to the callback URL.
- Admins configure allowed callback referrer hostnames in the admin **Cấu hình** tab, separated by semicolons (for example `link4m.com; gtraffic.io; layma.net`). The provider return must include a matching HTTPS `Referer`; Railway records the return IP before redirecting to the public browser callback page.
- The public browser route `/callback/<token>` does not require a Telegram session. Direct visits to this page do not record a provider return and fail validation. It rejects invalid, expired, reused, inactive-task, or IP-mismatched attempts with **Invalid token!**. Valid callbacks require Cloudflare Turnstile action `task_callback`; reward and ledger updates happen once in a database transaction.
- Link4m tasks store their API token encrypted with AES-256-GCM using `AUTH_SESSION_SECRET`. Starting a task asks the Link4m API to shorten that attempt's unique callback URL; the user sees the generated link and explicitly chooses **Làm ngay**. Rotate any API token that has been exposed, then enter its replacement only in the admin task form.
- Cloudflare Turnstile verification is shared through `lib/turnstile.ts`; `/api/captcha/verify` remains available for the existing `task_claim` action.

This is not yet a complete rewards application. User withdrawal request creation and leaderboard/check-in APIs still need implementation. The callback flow relies on Link4m redirecting the browser to the supplied callback URL and preserving an HTTPS `Referer` from `link4m.co`, `link4m.com`, or `link4m.org`; test this behavior before activating tasks. `Referer` is a browser source signal, not cryptographic proof from the provider.

## Environment variables

See `.env.example` for the complete list. Never commit real secrets or expose server-side secrets through `NEXT_PUBLIC_*`.
