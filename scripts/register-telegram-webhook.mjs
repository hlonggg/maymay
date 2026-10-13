import { createHash } from "node:crypto";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const configuredUrl = process.env.MINI_APP_URL?.trim();

if (!botToken) {
  console.error("TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

if (!configuredUrl) {
  console.error("MINI_APP_URL is not set.");
  process.exit(1);
}

let miniAppUrl;
try {
  miniAppUrl = new URL(configuredUrl);
  if (
    miniAppUrl.protocol !== "https:" ||
    miniAppUrl.username ||
    miniAppUrl.password ||
    miniAppUrl.search ||
    miniAppUrl.hash
  ) {
    throw new Error("MINI_APP_URL must be an HTTPS URL without credentials, query, or fragment.");
  }
} catch (error) {
  console.error("MINI_APP_URL is invalid:", error.message);
  process.exit(1);
}

const webhookUrl = new URL("/api/telegram/webhook", miniAppUrl).toString();
const secretToken = createHash("sha256")
  .update(`maymay-telegram-webhook-v1:${botToken}`)
  .digest("hex");

try {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();

  if (!response.ok || result.ok !== true) {
    console.error("Telegram rejected setWebhook:", result.description || response.status);
    process.exit(1);
  }

  console.log(`Telegram webhook registered: ${webhookUrl}`);
} catch (error) {
  console.error("Could not register Telegram webhook:", error.message);
  process.exit(1);
}
