import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminTelegramId, readSessionTelegramId } from "@/lib/telegram-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const telegramId = readSessionTelegramId(request);
  if (!telegramId) {
    return NextResponse.json({ error: "Cần đăng nhập bằng Telegram." }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        telegramId: true,
        username: true,
        firstName: true,
        balance: true,
        blockedAt: true,
        ledgerEntries: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            type: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user || user.blockedAt) {
      return NextResponse.json({ error: "Tài khoản không khả dụng." }, { status: 403 });
    }

    const tasks = await prisma.task.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        reward: true,
        minDurationSec: true,
        provider: true,
      },
    });

    const response = NextResponse.json({
      user: {
        telegramId: user.telegramId,
        username: user.username ?? user.firstName,
        balance: user.balance.toFixed(0),
        isAdmin: isAdminTelegramId(user.telegramId),
        transactions: user.ledgerEntries.map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: entry.amount.toFixed(0),
          createdAt: entry.createdAt.toISOString(),
        })),
      },
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        reward: task.reward.toFixed(0),
        minDurationSec: task.minDurationSec,
        provider: task.provider,
      })),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Could not load authenticated user data.", error);
    return NextResponse.json(
      { error: "Không thể tải dữ liệu. Kiểm tra kết nối PostgreSQL trên Railway." },
      { status: 503 },
    );
  }
}
