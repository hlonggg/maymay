import { isValidTelegramWebhookSecret, getMiniAppUrl } from "@/lib/telegram-webhook";

export const runtime = "nodejs";

type TelegramMessage = {
  text?: string;
  chat: {
    id: number;
    type: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStartMessage(update: unknown): TelegramMessage | null {
  if (!isRecord(update) || !isRecord(update.message)) return null;

  const { message } = update;
  if (
    !isRecord(message.chat) ||
    typeof message.chat.id !== "number" ||
    typeof message.chat.type !== "string" ||
    typeof message.text !== "string" ||
    !/^\/start(?:@\w+)?(?:\s|$)/i.test(message.text)
  ) {
    return null;
  }

  return {
    text: message.text,
    chat: { id: message.chat.id, type: message.chat.type },
  };
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("Telegram webhook is missing TELEGRAM_BOT_TOKEN.");
    return Response.json({ error: "Webhook chưa được cấu hình." }, { status: 503 });
  }

  if (
    !isValidTelegramWebhookSecret(
      request.headers.get("x-telegram-bot-api-secret-token"),
      botToken,
    )
  ) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 1_000_000) {
    return Response.json({ error: "Update quá lớn." }, { status: 413 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return Response.json({ error: "Update không hợp lệ." }, { status: 400 });
  }

  const message = getStartMessage(update);
  if (!message) return Response.json({ ok: true });

  if (message.chat.type !== "private") {
    return Response.json({ ok: true });
  }

  const webAppUrl = getMiniAppUrl();
  if (!webAppUrl) {
    console.error("Telegram /start could not build a Mini App URL from RAILWAY_PUBLIC_DOMAIN.");
    return Response.json({ error: "Chưa cấu hình domain Mini App." }, { status: 503 });
  }

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: message.chat.id,
        text: "Chào mừng bạn đến với MayMay! Nhấn nút bên dưới để mở Mini App.",
        reply_markup: {
          inline_keyboard: [[
            {
              text: "🚀 Mở Mini App",
              web_app: { url: webAppUrl },
            },
          ]],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const result: unknown = await telegramResponse.json();

    if (!telegramResponse.ok || !isRecord(result) || result.ok !== true) {
      console.error("Telegram sendMessage failed.", {
        status: telegramResponse.status,
        description: isRecord(result) ? result.description : undefined,
      });
      return Response.json({ error: "Không gửi được tin nhắn Telegram." }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram sendMessage request failed.", error);
    return Response.json({ error: "Không thể kết nối Telegram." }, { status: 502 });
  }
}
