import { createHash } from "node:crypto";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const domain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();

if (!botToken) {
  console.error("TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

if (!domain || domain.includes("/") || domain.includes("@")) {
  console.error("RAILWAY_PUBLIC_DOMAIN is missing or invalid.");
  process.exit(1);
}

const webhookUrl = `https://${domain}/api/telegram/webhook`;
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
