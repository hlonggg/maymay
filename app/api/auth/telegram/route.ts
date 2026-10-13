import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasSameOrigin } from "@/lib/request-origin";
import { issueSessionCookie, validateTelegramInitData } from "@/lib/telegram-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 10_000) {
    return NextResponse.json({ error: "Dữ liệu đăng nhập quá lớn." }, { status: 413 });
  }

  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu đăng nhập không hợp lệ." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("initData" in body) ||
    typeof body.initData !== "string"
  ) {
    return NextResponse.json({ error: "Thiếu dữ liệu xác thực Telegram." }, { status: 400 });
  }

  let telegramUser;
  try {
    telegramUser = validateTelegramInitData(body.initData);
  } catch (error) {
    if (error instanceof Error && error.message === "TELEGRAM_AUTH_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "Máy chủ chưa cấu hình Telegram bot." },
        { status: 503 },
      );
    }
    if (error instanceof Error && error.message === "EXPIRED_INIT_DATA") {
      return NextResponse.json(
        { error: "Phiên Telegram đã hết hạn. Hãy đóng và mở lại Mini App." },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: "Không xác minh được tài khoản Telegram." }, { status: 401 });
  }

  if (!process.env.AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET.length < 32) {
    return NextResponse.json(
      { error: "Máy chủ chưa cấu hình khóa phiên đăng nhập." },
      { status: 503 },
    );
  }

  try {
    const user = await prisma.user.upsert({
      where: { telegramId: String(telegramUser.id) },
      create: {
        telegramId: String(telegramUser.id),
        username: telegramUser.username ?? null,
        firstName: telegramUser.first_name ?? null,
        lastName: telegramUser.last_name ?? null,
      },
      update: {
        username: telegramUser.username ?? undefined,
        firstName: telegramUser.first_name ?? undefined,
        lastName: telegramUser.last_name ?? undefined,
      },
      select: { telegramId: true, blockedAt: true },
    });

    if (user.blockedAt) {
      return NextResponse.json({ error: "Tài khoản hiện không thể sử dụng dịch vụ." }, { status: 403 });
    }

    const response = NextResponse.json({ authenticated: true });
    issueSessionCookie(response, user.telegramId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Telegram sign-in database operation failed.", error);
    return NextResponse.json(
      { error: "Không thể lưu phiên đăng nhập. Hãy thử lại sau." },
      { status: 503 },
    );
  }
}
