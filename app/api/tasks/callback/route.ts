import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/request-origin";
import { getClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";
import { verifyTurnstile } from "@/lib/turnstile";
import { getMiniAppUrl } from "@/lib/telegram-webhook";

export const runtime = "nodejs";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function invalidToken() {
  return NextResponse.json({ error: "Invalid token!" }, { status: 410 });
}

function redirectToCallback(token: string): NextResponse {
  const base = getMiniAppUrl();
  if (!base) {
    return NextResponse.json({ error: "Mini App chưa cấu hình MINI_APP_URL." }, { status: 503 });
  }
  const response = NextResponse.redirect(new URL(`/callback/${token}`, base));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_PATTERN.test(token)) return redirectToCallback("invalid");

  const referer = request.headers.get("referer");
  const clientIp = getClientIp(request);
  if (!referer || !clientIp) return redirectToCallback(token);

  let refererHost: string;
  try {
    const refererUrl = new URL(referer);
    if (refererUrl.protocol !== "https:") return redirectToCallback(token);
    refererHost = refererUrl.hostname.toLowerCase();
  } catch {
    return redirectToCallback(token);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    const [attempt, setting] = await Promise.all([
      prisma.attempt.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          status: true,
          startedAt: true,
          expiresAt: true,
          goIp: true,
          task: { select: { status: true, provider: true } },
        },
      }),
      prisma.appSetting.findUnique({
        where: { key: "callback_referer_domain" },
        select: { value: true },
      }),
    ]);

    const allowedDomains = setting?.value.split(";").map((domain) => domain.trim().toLowerCase())
      .filter(Boolean) ?? [];
    const now = new Date();
    if (
      !attempt ||
      !(allowedDomains.includes(refererHost) || (
        attempt?.task.provider.toLowerCase() === "link4m" && refererHost === "link4m.com"
      )) ||
      attempt.status !== "STARTED" ||
      attempt.expiresAt <= now ||
      attempt.startedAt > now ||
      attempt.task.status !== "ACTIVE" ||
      !attempt.goIp ||
      attempt.goIp !== clientIp
    ) {
      return redirectToCallback(token);
    }

    const marked = await prisma.attempt.updateMany({
      where: {
        id: attempt.id,
        status: "STARTED",
        expiresAt: { gt: now },
        goIp: clientIp,
      },
      data: { callbackIp: clientIp },
    });
    if (marked.count !== 1) return redirectToCallback(token);
    return redirectToCallback(token);
  } catch (error) {
    console.error("Could not validate callback redirect source.", error);
    return NextResponse.json({ error: "Không thể kiểm tra nguồn callback." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 8_000) {
    return NextResponse.json({ error: "Dữ liệu callback quá lớn." }, { status: 413 });
  }
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu callback không hợp lệ." }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string" ||
    !TOKEN_PATTERN.test(body.token) ||
    !("mode" in body) ||
    (body.mode !== "inspect" && body.mode !== "claim")
  ) {
    return invalidToken();
  }

  const attemptToken = body.token;
  const mode = body.mode;
  const clientIp = getClientIp(request);
  if (!clientIp) {
    return NextResponse.json({ error: "Không xác định được IP của callback." }, { status: 503 });
  }

  const tokenHash = createHash("sha256").update(attemptToken).digest("hex");
  const now = new Date();

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { tokenHash },
      include: {
        task: { select: { title: true, reward: true, minDurationSec: true, status: true } },
      },
    });

    if (
      !attempt ||
      attempt.status !== "STARTED" ||
      attempt.expiresAt <= now ||
      attempt.startedAt > now ||
      attempt.task.status !== "ACTIVE" ||
      !attempt.goIp ||
      attempt.goIp !== clientIp ||
      attempt.callbackIp !== clientIp
    ) {
      return invalidToken();
    }

    const minimumWaitSeconds = Math.max(
      0,
      attempt.task.minDurationSec - Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000),
    );

    if (mode === "inspect") {
      return NextResponse.json({
        valid: true,
        task: { title: attempt.task.title, reward: attempt.task.reward.toFixed(0) },
        minimumWaitSeconds,
        expiresAt: attempt.expiresAt.toISOString(),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (
      !("captchaToken" in body) ||
      typeof body.captchaToken !== "string" ||
      body.captchaToken.length === 0 ||
      body.captchaToken.length > 2048
    ) {
      return NextResponse.json({ error: "Vui lòng hoàn thành captcha." }, { status: 400 });
    }
    if (!("sliderCompleted" in body) || body.sliderCompleted !== true) {
      return NextResponse.json({ error: "Vui lòng kéo thanh trượt xác nhận." }, { status: 400 });
    }
    if (minimumWaitSeconds > 0) {
      return NextResponse.json({
        error: `Hãy đợi thêm ${minimumWaitSeconds} giây để đủ thời gian nhiệm vụ.`,
        minimumWaitSeconds,
      }, { status: 425 });
    }

    const captcha = await verifyTurnstile(body.captchaToken, "task_callback", clientIp);
    if (!captcha.verified) {
      return NextResponse.json({ error: captcha.error }, { status: captcha.status });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.attempt.findUnique({
        where: { tokenHash },
        include: {
          task: { select: { reward: true, minDurationSec: true, status: true } },
          user: { select: { blockedAt: true } },
        },
      });
      const claimedAt = new Date();
      if (
        !current ||
        current.status !== "STARTED" ||
        current.expiresAt <= claimedAt ||
        current.startedAt > claimedAt ||
        current.task.status !== "ACTIVE" ||
        current.user.blockedAt ||
        !current.goIp ||
        current.goIp !== clientIp ||
        current.callbackIp !== clientIp ||
        claimedAt.getTime() - current.startedAt.getTime() < current.task.minDurationSec * 1000
      ) {
        throw new Error("INVALID_ATTEMPT");
      }

      const claimed = await transaction.attempt.updateMany({
        where: { id: current.id, status: "STARTED", expiresAt: { gt: claimedAt } },
        data: { status: "COMPLETED", completedAt: claimedAt, callbackIp: clientIp },
      });
      if (claimed.count !== 1) throw new Error("INVALID_ATTEMPT");

      const user = await transaction.user.update({
        where: { id: current.userId },
        data: { balance: { increment: current.task.reward } },
        select: { balance: true },
      });
      await transaction.ledgerEntry.create({
        data: {
          userId: current.userId,
          type: "TASK_REWARD",
          amount: current.task.reward,
          balanceAfter: user.balance,
          attemptId: current.id,
          note: `Thưởng nhiệm vụ ${current.taskId}`,
        },
      });
      return { reward: current.task.reward.toFixed(0), balance: user.balance.toFixed(0) };
    });

    return NextResponse.json({ completed: true, ...result }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ATTEMPT") return invalidToken();
    console.error("Could not complete task callback.", error);
    return NextResponse.json({ error: "Không thể xác nhận hoàn thành nhiệm vụ." }, { status: 503 });
  }
}
