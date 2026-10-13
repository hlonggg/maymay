import { NextResponse } from "next/server";
import { getAdminTelegramId } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!(await getAdminTelegramId(request))) {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const [users, blockedUsers, tasks, activeTasks, pendingWithdrawals, recentActivity] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.user.count({ where: { blockedAt: { not: null } } }),
        prisma.task.count(),
        prisma.task.count({ where: { status: "ACTIVE" } }),
        prisma.withdrawal.aggregate({
          where: { status: "PENDING" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, actorId: true, action: true, subjectId: true, createdAt: true },
        }),
      ]);

    return NextResponse.json({
      stats: {
        users,
        blockedUsers,
        tasks,
        activeTasks,
        pendingWithdrawals: pendingWithdrawals._count._all,
        pendingWithdrawalAmount: pendingWithdrawals._sum.amount?.toFixed(0) ?? "0",
      },
      configuration: {
        telegramBot: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        database: Boolean(process.env.DATABASE_URL),
        sessionSecret: Boolean(process.env.AUTH_SESSION_SECRET),
        miniAppUrl: Boolean(process.env.MINI_APP_URL),
        turnstile: Boolean(
          process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY,
        ),
      },
      activity: recentActivity.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load admin overview.", error);
    return NextResponse.json({ error: "Không thể tải trang tổng quan quản trị." }, { status: 503 });
  }
}
