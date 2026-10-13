import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getMiniAppUrl } from "@/lib/telegram-webhook";
import { hasSameOrigin } from "@/lib/request-origin";
import { getClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";
import { readSessionTelegramId } from "@/lib/telegram-auth";
import { decryptProviderCredential } from "@/lib/provider-credentials";

export const runtime = "nodejs";

const ATTEMPT_TTL_MS = 30 * 60 * 1000;

async function rejectAttempt(id: string) {
  await prisma.attempt.updateMany({
    where: { id, status: "STARTED" },
    data: { status: "REJECTED" },
  });
}

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
  let attemptId: string | null = null;
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
      select: {
        id: true,
        status: true,
        destinationUrl: true,
        provider: true,
        providerApiKeyEncrypted: true,
      },
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
    const attempt = await prisma.attempt.create({
      data: {
        tokenHash,
        userId: user.id,
        taskId: task.id,
        status: "STARTED",
        startedAt: now,
        expiresAt,
        goIp: clientIp,
      },
      select: { id: true },
    });
    attemptId = attempt.id;

    let redirectUrl: string;
    if (task.provider.toLowerCase() === "link4m") {
      if (!task.providerApiKeyEncrypted) {
        await rejectAttempt(attempt.id);
        return NextResponse.json({ error: "Nhiệm vụ chưa được cấu hình API key Link4m." }, { status: 503 });
      }
      const apiKey = decryptProviderCredential(task.providerApiKeyEncrypted);
      const shortenUrl = new URL(task.destinationUrl);
      shortenUrl.searchParams.set("api", apiKey);
      shortenUrl.searchParams.set("url", callbackUrl.toString());
      let apiResponse: Response;
      try {
        apiResponse = await fetch(shortenUrl, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
          headers: { Accept: "application/json" },
        });
      } catch {
        await rejectAttempt(attempt.id);
        console.error("Link4m shorten API request failed or timed out.");
        return NextResponse.json({ error: "Không thể kết nối Link4m để tạo link. Vui lòng thử lại." }, { status: 502 });
      }
      if (!apiResponse.ok) {
        await rejectAttempt(attempt.id);
        console.error("Link4m shorten API returned HTTP", apiResponse.status);
        return NextResponse.json({ error: "Link4m hiện không thể tạo link. Vui lòng thử lại sau." }, { status: 502 });
      }
      let apiResult: unknown;
      try {
        apiResult = await apiResponse.json();
      } catch {
        await rejectAttempt(attempt.id);
        return NextResponse.json({ error: "Link4m không trả về dữ liệu JSON hợp lệ." }, { status: 502 });
      }
      if (
        typeof apiResult !== "object" ||
        apiResult === null ||
        !("status" in apiResult) ||
        apiResult.status !== "success" ||
        !("shortenedUrl" in apiResult) ||
        typeof apiResult.shortenedUrl !== "string"
      ) {
        await rejectAttempt(attempt.id);
        return NextResponse.json({ error: "Link4m không trả về link rút gọn hợp lệ." }, { status: 502 });
      }
      let shortenedUrl: URL;
      try {
        shortenedUrl = new URL(apiResult.shortenedUrl);
      } catch {
        await rejectAttempt(attempt.id);
        return NextResponse.json({ error: "Link4m không trả về link rút gọn hợp lệ." }, { status: 502 });
      }
      if (
        shortenedUrl.protocol !== "https:" ||
        shortenedUrl.hostname !== "link4m.com" ||
        shortenedUrl.username !== "" ||
        shortenedUrl.password !== ""
      ) {
        await rejectAttempt(attempt.id);
        return NextResponse.json({ error: "Link4m trả về domain link rút gọn không hợp lệ." }, { status: 502 });
      }
      redirectUrl = shortenedUrl.toString();
    } else {
      const providerUrl = new URL(task.destinationUrl);
      providerUrl.searchParams.set("callback_url", callbackUrl.toString());
      redirectUrl = providerUrl.toString();
    }

    return NextResponse.json({
      redirectUrl,
      expiresAt: expiresAt.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (attemptId) {
      try {
        await rejectAttempt(attemptId);
      } catch {
        console.error("Could not reject the failed task attempt.");
      }
    }
    console.error("Could not start task attempt.", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Không thể bắt đầu nhiệm vụ." }, { status: 503 });
  }
}
