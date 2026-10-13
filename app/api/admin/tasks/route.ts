import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminTelegramId, readSessionTelegramId } from "@/lib/telegram-auth";

export const runtime = "nodejs";

async function getAdminId(request: Request): Promise<string | null> {
  const telegramId = readSessionTelegramId(request);
  if (!telegramId || !isAdminTelegramId(telegramId)) return null;

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { blockedAt: true },
  });
  if (!user || user.blockedAt) return null;
  return telegramId;
}

export async function GET(request: Request) {
  try {
    const telegramId = await getAdminId(request);
    if (!telegramId) {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        description: true,
        destinationUrl: true,
        provider: true,
        reward: true,
        status: true,
        minDurationSec: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      tasks: tasks.map((task) => ({
        ...task,
        reward: task.reward.toFixed(0),
        createdAt: task.createdAt.toISOString(),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load admin task list.", error);
    return NextResponse.json({ error: "Không thể tải danh sách nhiệm vụ." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 16_000) {
    return NextResponse.json({ error: "Dữ liệu nhiệm vụ quá lớn." }, { status: 413 });
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }

  let telegramId: string | null;
  try {
    telegramId = await getAdminId(request);
  } catch (error) {
    console.error("Could not verify admin session for task creation.", error);
    return NextResponse.json({ error: "Không thể xác minh quyền quản trị." }, { status: 503 });
  }
  if (!telegramId) {
    return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu nhiệm vụ không hợp lệ." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Dữ liệu nhiệm vụ không hợp lệ." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = body.title;
  if ("description" in body) data.description = body.description;
  if ("provider" in body) data.provider = body.provider;
  if ("destinationUrl" in body) data.destinationUrl = body.destinationUrl;
  if ("reward" in body) data.reward = body.reward;
  if ("minDurationSec" in body) data.minDurationSec = body.minDurationSec;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const provider = typeof data.provider === "string" ? data.provider.trim() : "";
  const destinationUrl =
    typeof data.destinationUrl === "string" ? data.destinationUrl.trim() : "";
  const reward = typeof data.reward === "string" || typeof data.reward === "number"
    ? Number(data.reward)
    : Number.NaN;
  const minDurationSec = Number(data.minDurationSec);

  let destination: URL;
  try {
    destination = new URL(destinationUrl);
  } catch {
    return NextResponse.json({ error: "URL đích không hợp lệ." }, { status: 400 });
  }

  if (
    title.length < 3 ||
    title.length > 100 ||
    description.length > 500 ||
    !/^[a-zA-Z0-9_-]{2,40}$/.test(provider) ||
    destination.protocol !== "https:" ||
    destination.username !== "" ||
    destination.password !== "" ||
    !Number.isSafeInteger(reward) ||
    reward < 1 ||
    reward > 1_000_000 ||
    !Number.isInteger(minDurationSec) ||
    minDurationSec < 0 ||
    minDurationSec > 86_400
  ) {
    return NextResponse.json({ error: "Thông tin nhiệm vụ không hợp lệ." }, { status: 400 });
  }

  try {
    const task = await prisma.$transaction(async (transaction) => {
      const created = await transaction.task.create({
        data: {
          title,
          description: description || null,
          destinationUrl: destination.toString(),
          provider,
          reward,
          minDurationSec,
          status: "PAUSED",
        },
        select: {
          id: true,
          title: true,
          description: true,
          provider: true,
          reward: true,
          status: true,
          minDurationSec: true,
          createdAt: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorId: telegramId,
          action: "TASK_CREATED",
          subjectId: created.id,
          metadata: { status: created.status, provider: created.provider },
        },
      });

      return created;
    });

    return NextResponse.json({
      task: {
        ...task,
        reward: task.reward.toFixed(0),
        createdAt: task.createdAt.toISOString(),
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not create admin task.", error);
    return NextResponse.json({ error: "Không thể lưu nhiệm vụ vào PostgreSQL." }, { status: 503 });
  }
}
