import { createHash, timingSafeEqual } from "node:crypto";

const WEBHOOK_SECRET_CONTEXT = "maymay-telegram-webhook-v1:";

export function getTelegramWebhookSecret(botToken: string): string {
  return createHash("sha256").update(`${WEBHOOK_SECRET_CONTEXT}${botToken}`).digest("hex");
}

export function isValidTelegramWebhookSecret(
  providedSecret: string | null,
  botToken: string,
): boolean {
  if (!providedSecret) return false;

  const expected = Buffer.from(getTelegramWebhookSecret(botToken));
  const provided = Buffer.from(providedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function getMiniAppUrl(): string | null {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (!domain || domain.includes("/") || domain.includes("@")) return null;

  try {
    const url = new URL(`https://${domain}`);
    if (url.protocol !== "https:" || url.hostname !== domain.toLowerCase()) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
