import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getMiniAppUrl } from "@/lib/telegram-webhook";
import { hasSameOrigin } from "@/lib/request-origin";
import { getClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";
import { readSessionTelegramId } from "@/lib/telegram-auth";

export const runtime = "nodejs";

const ATTEMPT_TTL_MS = 30 * 60 * 1000;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 4_000) {
    return NextResponse.json({ error: "Dữ liệu yêu cầu quá lớn." }, { status: 413 });
  }
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }

  const telegramId = readSessionTelegramId(request);
  if (!telegramId) {
    return NextResponse.json({ error: "Cần đăng nhập bằng Telegram." }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  if (!clientIp) {
    return NextResponse.json({ error: "Không xác định được IP của phiên làm nhiệm vụ." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu nhiệm vụ không hợp lệ." }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("taskId" in body) ||
    typeof body.taskId !== "string" ||
    body.taskId.length < 1 ||
    body.taskId.length > 128
  ) {
    return NextResponse.json({ error: "Mã nhiệm vụ không hợp lệ." }, { status: 400 });
  }
  const taskId = body.taskId;

  const miniAppUrl = getMiniAppUrl();
  if (!miniAppUrl) {
    return NextResponse.json({ error: "Mini App chưa cấu hình MINI_APP_URL." }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, blockedAt: true },
    });
    if (!user || user.blockedAt) {
      return NextResponse.json({ error: "Tài khoản không khả dụng." }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, status: true, destinationUrl: true },
    });
    if (!task || task.status !== "ACTIVE") {
      return NextResponse.json({ error: "Nhiệm vụ hiện không khả dụng." }, { status: 404 });
    }

    const now = new Date();
    const activeAttempt = await prisma.attempt.findFirst({
      where: { userId: user.id, taskId: task.id, status: "STARTED", expiresAt: { gt: now } },
      select: { id: true },
    });
    if (activeAttempt) {
      return NextResponse.json({
        error: "Bạn đã có một phiên đang làm nhiệm vụ này. Hãy hoàn tất hoặc đợi phiên hết hạn.",
      }, { status: 409 });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(now.getTime() + ATTEMPT_TTL_MS);
    const callbackUrl = new URL("/api/tasks/callback", miniAppUrl);
    callbackUrl.searchParams.set("token", token);
    const providerUrl = new URL(task.destinationUrl);
    providerUrl.searchParams.set("callback_url", callbackUrl.toString());

    await prisma.attempt.create({
      data: {
        tokenHash,
        userId: user.id,
        taskId: task.id,
        status: "STARTED",
        startedAt: now,
        expiresAt,
        goIp: clientIp,
      },
    });

    return NextResponse.json({
      redirectUrl: providerUrl.toString(),
      expiresAt: expiresAt.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not start task attempt.", error);
    return NextResponse.json({ error: "Không thể bắt đầu nhiệm vụ." }, { status: 503 });
  }
}
